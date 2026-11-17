import { ApplicationTable } from "@/components/application-table";

export default function ApplicationsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h2>Application Queue</h2>
          <p>Search, filter, score, and route submitted loan applications.</p>
        </div>
      </div>
      <ApplicationTable />
    </>
  );
}
