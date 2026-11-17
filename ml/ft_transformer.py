import torch
import torch.nn as nn
import torch.nn.functional as F
import math
from typing import Dict, List, Optional

class FTTransformer(nn.Module):
    def __init__(
        self,
        num_continuous: int,
        categorical_cardinalities: List[int],
        dim: int = 192,
        depth: int = 3,
        heads: int = 8,
        attn_dropout: float = 0.2,
        ff_dropout: float = 0.1,
    ):
        super().__init__()
        self.num_continuous = num_continuous
        self.num_categorical = len(categorical_cardinalities)
        
        # Tokenizer for continuous features
        # Projects each scalar continuous feature to a vector of size `dim`
        if self.num_continuous > 0:
            self.cont_embeddings = nn.Parameter(torch.empty(num_continuous, dim))
            self.cont_bias = nn.Parameter(torch.empty(num_continuous, dim))
            nn.init.kaiming_uniform_(self.cont_embeddings, a=math.sqrt(5))
            nn.init.zeros_(self.cont_bias)
            
        # Tokenizer for categorical features
        if self.num_categorical > 0:
            self.cat_embeddings = nn.ModuleList([
                nn.Embedding(cardinality, dim) for cardinality in categorical_cardinalities
            ])
            
        # CLS Token
        self.cls_token = nn.Parameter(torch.zeros(1, 1, dim))
        
        # Transformer Encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=dim,
            nhead=heads,
            dim_feedforward=dim * 4,
            dropout=ff_dropout,
            activation="relu",
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=depth)
        
        # Layer Normalization
        self.layer_norm = nn.LayerNorm(dim)
        
        # Classification Head
        self.head = nn.Sequential(
            nn.LayerNorm(dim),
            nn.ReLU(),
            nn.Linear(dim, 1)
        )

    def forward(self, x_cont: Optional[torch.Tensor], x_cat: Optional[torch.Tensor]) -> torch.Tensor:
        batch_size = x_cont.shape[0] if x_cont is not None else x_cat.shape[0]
        tokens = []
        
        # CLS Token
        cls_tokens = self.cls_token.expand(batch_size, -1, -1)
        tokens.append(cls_tokens)
        
        # Continuous Tokens
        if self.num_continuous > 0 and x_cont is not None:
            # x_cont: (B, num_continuous)
            # expanded: (B, num_continuous, dim)
            x_cont_expanded = x_cont.unsqueeze(-1) * self.cont_embeddings.unsqueeze(0) + self.cont_bias.unsqueeze(0)
            tokens.append(x_cont_expanded)
            
        # Categorical Tokens
        if self.num_categorical > 0 and x_cat is not None:
            # x_cat: (B, num_categorical)
            cat_tokens = []
            for i in range(self.num_categorical):
                cat_tokens.append(self.cat_embeddings[i](x_cat[:, i]).unsqueeze(1))
            cat_tokens = torch.cat(cat_tokens, dim=1)
            tokens.append(cat_tokens)
            
        # Concatenate all tokens
        x = torch.cat(tokens, dim=1)
        
        # Apply Transformer
        x = self.transformer(x)
        
        # Use CLS token for classification
        cls_out = x[:, 0, :]
        cls_out = self.layer_norm(cls_out)
        
        # Output logits
        logits = self.head(cls_out)
        return logits.squeeze(-1)

class FocalLoss(nn.Module):
    def __init__(self, alpha=0.75, gamma=2.0, reduction='mean'):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, logits, targets):
        bce_loss = F.binary_cross_entropy_with_logits(logits, targets, reduction='none')
        pt = torch.exp(-bce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * bce_loss
        
        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss
