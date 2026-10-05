import type { Annotation } from '@/lib/stores';
import { can } from '@/lib/permissions';
import type { Session } from '@/lib/session';
import { VerdictBadge } from './Badge';
import { deleteAnnotationAction, editAnnotationAction, reviewAnnotationAction } from '@/app/actions';

const STATUS_CLASS = { pending: 'badge amber', approved: 'badge green', declined: 'badge red' } as const;

export function AnnotationItem({ a, session, back, label }: { a: Annotation; session: Session; back: string; label?: string }) {
  const canEdit = can(session.r, 'annotation:edit', { owner: a.author, user: session.u });
  const canDelete = can(session.r, 'annotation:delete', { owner: a.author, user: session.u });
  const canReview = can(session.r, 'annotation:review');
  return (
    <div className="card" data-testid="annotation" data-status={a.status}>
      <div className="row">
        <VerdictBadge verdict={a.verdict} testId="annotation-verdict" />
        <span className={STATUS_CLASS[a.status]} data-testid="annotation-status">{a.status}</span>
        <span className="mut">{a.author} · {a.updated_at.slice(0, 16).replace('T', ' ')}{a.reviewed_by ? ` · reviewed by ${a.reviewed_by}` : ''}</span>
        {label && <span className="mut">· {label}</span>}
      </div>
      <p data-testid="annotation-text">{a.text}</p>
      <p className="mut">{a.baseline_run} → {a.candidate_run}</p>
      {canEdit && (
        <form action={editAnnotationAction.bind(null, a.id)} className="row">
          <input type="hidden" name="back" value={back} />
          <input name="text" defaultValue={a.text} aria-label="annotation text" style={{ flex: 1 }} />
          <button type="submit">Save</button>
        </form>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        {canReview && a.status !== 'approved' && (
          <form action={reviewAnnotationAction.bind(null, a.id, 'approved')}><input type="hidden" name="back" value={back} /><button className="ok" type="submit">Approve</button></form>
        )}
        {canReview && a.status !== 'declined' && (
          <form action={reviewAnnotationAction.bind(null, a.id, 'declined')}><input type="hidden" name="back" value={back} /><button className="danger" type="submit">Decline</button></form>
        )}
        {canDelete && (
          <form action={deleteAnnotationAction.bind(null, a.id)}><input type="hidden" name="back" value={back} /><button className="danger" type="submit">Delete</button></form>
        )}
      </div>
    </div>
  );
}
