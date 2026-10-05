import { requireCan } from '@/lib/auth';
import { ExperimentForm } from '@/components/ExperimentForm';
import { createExperimentAction } from '../../actions';

export default async function NewExperiment() {
  await requireCan('experiment:write');
  return (<><h1>New experiment</h1><ExperimentForm action={createExperimentAction} submit="Create" /></>);
}
