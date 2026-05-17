import { redirect } from 'next/navigation';

/** Legacy global participants URL — project coordination is project-scoped. */
export default function ParticipantsPage() {
  redirect('/dashboard/projects');
}
