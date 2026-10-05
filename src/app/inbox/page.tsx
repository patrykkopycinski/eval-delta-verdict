import { requireSession } from '@/lib/auth';
import { listAnnotations, listExperiments } from '@/lib/stores';
import { AnnotationItem } from '@/components/AnnotationItem';

export const dynamic = 'force-dynamic';

/** D7: approval/annotation inbox — the CRUD heart. */
export default async function Inbox() {
  const s = await requireSession();
  const [all, exps] = await Promise.all([listAnnotations(), listExperiments()]);
  const name = (id: string) => exps.find((e) => e.id === id)?.name ?? id;
  const groups = [
    ['Pending approval', all.filter((a) => a.status === 'pending')],
    ['Approved', all.filter((a) => a.status === 'approved')],
    ['Declined', all.filter((a) => a.status === 'declined')],
  ] as const;
  return (
    <>
      <h1>Inbox</h1>
      <p className="mut">Annotations on verdicts. Viewers propose; admins approve or decline.</p>
      {groups.map(([title, items]) => (
        <section key={title}>
          <h2>{title} ({items.length})</h2>
          {items.length === 0 && <div className="mut">Nothing here.</div>}
          {items.map((a) => <AnnotationItem key={a.id} a={a} session={s} back="/inbox" label={name(a.experiment_id)} />)}
        </section>
      ))}
    </>
  );
}
