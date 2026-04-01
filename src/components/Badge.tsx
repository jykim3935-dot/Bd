import { ProjectSource, SOURCE_CONFIG } from '@/lib/types';

export default function Badge({ source }: { source: ProjectSource }) {
  const config = SOURCE_CONFIG[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      {config.label}
    </span>
  );
}
