import { getInboxEntries } from "@/features/inbox/actions/inbox.actions";
import { InboxList } from "@/features/inbox/components/inbox-list";
import { InboxEntryDialog } from "@/features/inbox/components/inbox-entry-dialog";

export default async function InboxPage() {
  const entries = await getInboxEntries();

  const pending = entries.filter((e) => e.status === "PENDING");
  const processed = entries.filter((e) => e.status === "PROCESSED");
  const archived = entries.filter((e) => e.status === "ARCHIVED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            Inbox
          </h1>
          <p className="text-sm text-neutral-500">
            {pending.length} pending · {processed.length} processed
          </p>
        </div>
        <InboxEntryDialog />
      </div>

      <InboxList entries={entries} />
    </div>
  );
}
