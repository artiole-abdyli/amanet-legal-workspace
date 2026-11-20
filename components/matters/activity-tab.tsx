import { Card } from "@/components/ui/card";
import { GroupedTimeline } from "@/components/ui/timeline";
import { getMatterActivity } from "@/lib/queries";

export async function ActivityTab({ matterId }: { matterId: string }) {
  const events = await getMatterActivity(matterId);

  return (
    <Card>
      <GroupedTimeline
        entries={events.map((event) => ({
          id: event.id,
          type: event.type,
          summary: event.summary,
          actorName: event.actorName,
          createdAt: event.createdAt,
        }))}
      />
    </Card>
  );
}
