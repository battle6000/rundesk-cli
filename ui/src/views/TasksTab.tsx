/**
 * Where tasks will be, once there are any.
 *
 * **Nothing is read here and nothing is invented.** This product does not keep tasks, so a
 * count, a card or even a loading skeleton would each be this console claiming to know
 * something that does not exist anywhere in the install it is showing.
 */
const COLUMNS = ["To do", "In progress", "Done"];

export function TasksTab() {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((column) => (
          <div
            key={column}
            className="min-h-[200px] rounded-lg border border-dashed px-4 py-3 text-muted-foreground"
          >
            {column}
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Not connected — this install of Rundesk does not keep tasks. Tasks live in your
        rundesk.ai workspace, and this view will connect to it in a later release.
      </p>
    </>
  );
}
