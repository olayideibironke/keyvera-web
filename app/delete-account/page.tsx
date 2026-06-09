export const metadata = {
  title: "Delete Account | Keyvera",
  description:
    "Request deletion of your Keyvera account and associated data.",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#F5F7F9] px-6 py-24 text-[#0F2A36]">
      <section className="mx-auto max-w-4xl rounded-[32px] border border-[#E8EFF3] bg-white p-8 shadow-sm md:p-12">
        <p className="mb-4 inline-flex rounded-full border border-[rgba(34,166,118,0.18)] bg-[rgba(34,166,118,0.08)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#22A676]">
          Account Deletion
        </p>

        <h1 className="text-4xl font-black tracking-tight text-[#0F2A36] md:text-5xl">
          Delete Your Keyvera Account or Data
        </h1>

        <p className="mt-4 text-sm font-bold text-[#3D5A68]">
          Last updated: June 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-[#3D5A68]">
          <section>
            <p>
              Keyvera allows users to request deletion of their account and
              associated personal data.
            </p>

            <p className="mt-4">
              If you would like to delete your Keyvera account, or request
              deletion of personal information you submitted through the Keyvera
              app or website, please contact us using the email below.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-black text-[#0F2A36]">
              How to Request Account Deletion
            </h2>

            <p>
              Send an email to:{" "}
              <a
                className="font-black text-[#1A3C4A] underline"
                href="mailto:support@keyvera.org"
              >
                support@keyvera.org
              </a>
            </p>

            <p className="mt-4">Please include:</p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>The email address associated with your Keyvera account</li>
              <li>Your name, if available</li>
              <li>
                A clear request, such as: “Please delete my Keyvera account and
                associated data.”
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-black text-[#0F2A36]">
              What Data May Be Deleted
            </h2>

            <p>
              When you request account deletion, Keyvera may delete or
              deactivate information associated with your account, including:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Account profile information</li>
              <li>Contact information</li>
              <li>
                Role information, such as tenant, landlord, agent, or
                administrator
              </li>
              <li>Property listing information submitted through the platform</li>
              <li>Inspection request information</li>
              <li>Inspection scheduling information</li>
              <li>Inspection report information</li>
              <li>Notes or information submitted through forms</li>
              <li>
                Photos or documents voluntarily uploaded through the app or
                website, where applicable
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-black text-[#0F2A36]">
              Data We May Need to Keep
            </h2>

            <p>
              Some information may be retained for a limited period if needed
              for legal, security, fraud prevention, dispute resolution,
              accounting, operational, marketplace integrity, or compliance
              purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-black text-[#0F2A36]">
              Partial Data Deletion Requests
            </h2>

            <p>
              You may also contact us to request correction or deletion of
              certain information without deleting your full account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-black text-[#0F2A36]">
              Processing Time
            </h2>

            <p>
              We will review deletion requests and respond within a reasonable
              timeframe.
            </p>
          </section>

          <section className="rounded-[24px] border border-[#E8EFF3] bg-[#F8FAFB] p-6">
            <h2 className="mb-3 text-2xl font-black text-[#0F2A36]">
              Contact
            </h2>

            <p>
              Email:{" "}
              <a
                className="font-black text-[#1A3C4A] underline"
                href="mailto:support@keyvera.org"
              >
                support@keyvera.org
              </a>
            </p>

            <p>
              Website:{" "}
              <a
                className="font-black text-[#1A3C4A] underline"
                href="https://www.keyvera.org"
              >
                https://www.keyvera.org
              </a>
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}