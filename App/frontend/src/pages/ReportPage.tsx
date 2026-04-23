import { useEffect } from 'react';
import ReportWizard from '../report/ReportWizard';
import { useCivic } from '../context/CivicContext';

export default function ReportPage() {
  const { refreshDraftFlag } = useCivic();
  useEffect(() => {
    refreshDraftFlag();
  }, [refreshDraftFlag]);
  return <ReportWizard />;
}
