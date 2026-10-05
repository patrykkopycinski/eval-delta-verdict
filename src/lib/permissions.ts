/**
 * Role model (spec criterion 1).
 *  admin  : everything, incl. experiment CRUD, thresholds, approve/decline.
 *  viewer : read everything; add annotations (land as 'pending'); edit/delete own annotations.
 */
import type { Role } from './session';

export type Action =
  | 'experiment:write'
  | 'annotation:create'
  | 'annotation:edit'
  | 'annotation:delete'
  | 'annotation:review';

export function can(role: Role, action: Action, ctx: { owner?: string; user?: string } = {}): boolean {
  if (role === 'admin') return true;
  switch (action) {
    case 'annotation:create':
      return true;
    case 'annotation:edit':
    case 'annotation:delete':
      return !!ctx.owner && ctx.owner === ctx.user;
    default:
      return false;
  }
}
