import { notFound } from 'next/navigation';
import { requireCan } from '@/lib/auth';
import { getExperiment } from '@/lib/stores';
import { ExperimentForm } from '@/components/ExperimentForm';
import { updateExperimentAction } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function EditExperiment({ params }: { params: Promise<{ id: string }> }) {
  await requireCan('experiment:write');
  const { id } = await params;
  const exp = await getExperiment(id);
  if (!exp) notFound();
  return (<><h1>Edit {exp.name}</h1><ExperimentForm action={updateExperimentAction.bind(null, id)} exp={exp} submit="Save" /></>);
}
