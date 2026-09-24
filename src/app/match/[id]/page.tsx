import { MatchJobView } from '@/components/MatchJobView';

export const dynamic = 'force-dynamic';

export default async function MatchJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchJobView jobId={id} />;
}
