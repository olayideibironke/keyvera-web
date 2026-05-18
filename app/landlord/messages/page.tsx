// app/landlord/messages/page.tsx
import EmptyState from "@/app/ui/empty-state";

export const metadata = {
  title: "Messages — Keyvera Landlord",
};

export default function LandlordMessagesPage() {
  return (
    <>
      <div className="kv-portal-top">
        <div>
          <h1 className="kv-portal-title">Messages</h1>
          <p className="kv-portal-subtitle">
            Conversations with agents, tenants, and Keyvera support.
          </p>
        </div>
      </div>

      <div
        className="kv-card"
        style={{ padding: "56px 32px", borderRadius: 22 }}
      >
        <EmptyState
          icon="✉"
          title="Messages coming soon"
          description="Direct messaging between landlords, agents, and tenants is rolling out as part of the next platform release. You will see your inbox here when it goes live."
        />
      </div>
    </>
  );
}
