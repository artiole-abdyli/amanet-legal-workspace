import { addNote, addTask } from "@/app/actions/matters";
import { Icon } from "@/components/icons";
import { TaskCheckbox } from "@/components/matters/task-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DueDate } from "@/components/ui/meta";
import { Field, Input, Textarea, ValidatedForm } from "@/components/ui/form";
import { LIMITS } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import { getMatter, getMatterTasksAndNotes } from "@/lib/queries";

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export async function TasksNotesTab({ matterId }: { matterId: string }) {
  const [matter, { tasks, notes }] = await Promise.all([
    getMatter(matterId),
    getMatterTasksAndNotes(matterId),
  ]);
  const archived = matter?.archivedAt !== null;

  const open = tasks.filter((task) => !task.completedAt);
  const done = tasks.filter((task) => task.completedAt);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title="Tasks"
          aside={<span className="text-muted">{open.length} open</span>}
        />

        {archived ? null : (
          <ValidatedForm
            action={addTask.bind(null, matterId)}
            className="flex flex-wrap items-start gap-2"
          >
            <Field label="New task" hideLabel className="min-w-0 flex-1 basis-[180px]">
              <Input
                name="title"
                required
                data-max={LIMITS.title}
                data-msg-required="Write the task before adding it."
                placeholder="Add a task"
              />
            </Field>
            <Field label="Due date" hideLabel>
              <Input type="date" name="dueDate" defaultValue={defaultDueDate()} />
            </Field>
            <Button type="submit">
              <Icon name="plus" />
              Add
            </Button>
          </ValidatedForm>
        )}

        {tasks.length === 0 ? (
          <p className="text-muted">No tasks yet.</p>
        ) : (
          <div className="flex flex-col">
            {[...open, ...done].map((task) => (
              <TaskCheckbox
                key={task.id}
                taskId={task.id}
                title={task.title}
                done={task.completedAt !== null}
                disabled={archived}
                meta={
                  task.dueDate ? (
                    <DueDate date={task.dueDate} prefix="Due" />
                  ) : (
                    "No due date"
                  )
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Internal notes"
          aside={
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
              <Icon name="lock" className="size-3.5" />
              Never visible to clients
            </span>
          }
        />

        {archived ? null : (
          <ValidatedForm
            action={addNote.bind(null, matterId)}
            className="flex flex-col gap-2"
          >
            <Field label="New note" hideLabel>
              <Textarea
                name="body"
                required
                rows={3}
                data-max={LIMITS.note}
                data-msg-required="Write the note before adding it."
                placeholder="Write a note for the team"
                className="resize-y"
              />
            </Field>
            <div>
              <Button type="submit">Add note</Button>
            </div>
          </ValidatedForm>
        )}

        {notes.length === 0 ? (
          <p className="text-muted">No notes yet.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-bg px-3 py-2.5"
            >
              <p>{note.body}</p>
              <small className="text-muted">
                {note.authorName} · {formatDateTime(note.createdAt)}
              </small>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
