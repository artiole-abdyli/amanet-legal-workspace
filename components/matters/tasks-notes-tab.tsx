import {
  addNote,
  addTask,
  deleteNote,
  deleteTask,
  updateNote,
  updateTask,
} from "@/app/actions/matters";
import { Icon } from "@/components/icons";
import { TaskCheckbox } from "@/components/matters/task-checkbox";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DueDate } from "@/components/ui/meta";
import { Field, Input, Textarea, ValidatedForm } from "@/components/ui/form";
import { LIMITS } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import { getMatter, getMatterTasksAndNotes } from "@/lib/queries";

function dateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Edit and delete sit behind one small menu, so the list stays calm. */
function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="relative shrink-0">
      <summary
        aria-label={label}
        className={buttonClasses("ghost", "sm")}
      >
        <Icon name="pen" className="size-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-2 flex w-[min(340px,80vw)] flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-card">
        {children}
      </div>
    </details>
  );
}

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
              <div
                key={task.id}
                className="flex items-start gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0"
              >
                <TaskCheckbox
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
                {archived ? null : (
                  // Keyed on what it edits, so a saved change remounts it closed.
                  <RowMenu
                    key={`${task.title}|${dateInput(task.dueDate)}`}
                    label={`Edit task: ${task.title}`}
                  >
                    <ValidatedForm
                      action={updateTask.bind(null, task.id)}
                      className="flex flex-col gap-2"
                    >
                      <Field label="Task" required>
                        <Input
                          name="title"
                          required
                          defaultValue={task.title}
                          data-max={LIMITS.title}
                          data-msg-required="A task needs a title."
                        />
                      </Field>
                      <Field label="Due date">
                        <Input
                          type="date"
                          name="dueDate"
                          defaultValue={dateInput(task.dueDate)}
                        />
                      </Field>
                      <Button type="submit" variant="primary" size="sm">
                        Save task
                      </Button>
                    </ValidatedForm>
                    <form
                      action={deleteTask.bind(null, task.id)}
                      className="border-t border-line pt-3"
                    >
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        Delete task
                      </Button>
                    </form>
                  </RowMenu>
                )}
              </div>
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
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-line">{note.body}</p>
                {archived ? null : (
                  <RowMenu key={note.updatedAt.toISOString()} label="Edit note">
                    <ValidatedForm
                      action={updateNote.bind(null, note.id)}
                      className="flex flex-col gap-2"
                    >
                      <Field label="Note" required>
                        <Textarea
                          name="body"
                          required
                          rows={4}
                          defaultValue={note.body}
                          data-max={LIMITS.note}
                          data-msg-required="A note cannot be empty."
                          className="resize-y"
                        />
                      </Field>
                      <Button type="submit" variant="primary" size="sm">
                        Save note
                      </Button>
                    </ValidatedForm>
                    <form
                      action={deleteNote.bind(null, note.id)}
                      className="border-t border-line pt-3"
                    >
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        Delete note
                      </Button>
                    </form>
                  </RowMenu>
                )}
              </div>
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
