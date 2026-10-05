'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { endSession, getSession, requireCan, startSession, verifyLogin } from '@/lib/auth';
import {
  createAnnotation,
  createExperiment,
  deleteAnnotation,
  deleteExperiment,
  getAnnotation,
  parseThresholds,
  reviewAnnotation,
  updateAnnotationText,
  updateExperiment,
} from '@/lib/stores';
import { VERDICT_CLASSES, type VerdictClass } from '@/lib/verdict';
import { can } from '@/lib/permissions';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function loginAction(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const user = await verifyLogin(str(form, 'username'), String(form.get('password') ?? ''));
  if (!user) return { error: 'Invalid username or password' };
  await startSession(user);
  const next = str(form, 'next');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logoutAction() {
  await endSession();
  redirect('/login');
}

function experimentInput(form: FormData) {
  const name = str(form, 'name');
  const experiment_name = str(form, 'experiment_name');
  if (!name || !experiment_name) throw new Error('name and experiment_name are required');
  return {
    name,
    experiment_name,
    description: str(form, 'description'),
    thresholds: parseThresholds((k) => (form.has(k) ? String(form.get(k)) : null)),
  };
}

export async function createExperimentAction(form: FormData) {
  const s = await requireCan('experiment:write');
  const id = await createExperiment(experimentInput(form), s.u);
  revalidatePath('/experiments');
  redirect(`/experiments/${id}`);
}

export async function updateExperimentAction(id: string, form: FormData) {
  await requireCan('experiment:write');
  await updateExperiment(id, experimentInput(form));
  revalidatePath('/', 'layout');
  redirect(`/experiments/${id}`);
}

export async function deleteExperimentAction(id: string) {
  await requireCan('experiment:write');
  await deleteExperiment(id);
  revalidatePath('/', 'layout');
  redirect('/experiments');
}

export async function addAnnotationAction(experimentId: string, form: FormData) {
  const s = await requireCan('annotation:create');
  const text = str(form, 'text');
  const verdict = str(form, 'verdict') as VerdictClass;
  if (!text || !VERDICT_CLASSES.includes(verdict)) throw new Error('invalid annotation');
  await createAnnotation(
    { experiment_id: experimentId, baseline_run: str(form, 'baseline'), candidate_run: str(form, 'candidate'), verdict, text },
    s.u,
  );
  revalidatePath(`/experiments/${experimentId}`);
  revalidatePath('/inbox');
  redirect(`/experiments/${experimentId}?baseline=${encodeURIComponent(str(form, 'baseline'))}&candidate=${encodeURIComponent(str(form, 'candidate'))}`);
}

export async function editAnnotationAction(id: string, form: FormData) {
  const a = await getAnnotation(id);
  if (!a) throw new Error('not found');
  await requireCan('annotation:edit', { owner: a.author });
  const text = str(form, 'text');
  if (!text) throw new Error('text required');
  await updateAnnotationText(id, text);
  revalidatePath('/', 'layout');
  redirect(String(form.get('back') ?? '/inbox'));
}

export async function deleteAnnotationAction(id: string, form: FormData) {
  const a = await getAnnotation(id);
  if (!a) throw new Error('not found');
  await requireCan('annotation:delete', { owner: a.author });
  await deleteAnnotation(id);
  revalidatePath('/', 'layout');
  redirect(String(form.get('back') ?? '/inbox'));
}

export async function reviewAnnotationAction(id: string, status: 'approved' | 'declined', form: FormData) {
  const s = await requireCan('annotation:review');
  await reviewAnnotation(id, status, s.u);
  revalidatePath('/', 'layout');
  redirect(String(form.get('back') ?? '/inbox'));
}

export async function canEditAnnotation(owner: string): Promise<boolean> {
  const s = await getSession();
  return !!s && can(s.r, 'annotation:edit', { owner, user: s.u });
}
