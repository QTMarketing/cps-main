import { ChequeLayout } from "./ChequeLayout";
import { ChequeViewModel } from "@/lib/cheques/types";

interface Props {
  cheque?: ChequeViewModel | null;
  isLoading?: boolean;
  error?: string | null;
}

export default function ChequePreview({ cheque, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Loading cheque details…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!cheque) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Select a cheque to preview.
      </div>
    );
  }

  return <ChequeLayout cheque={cheque} />;
}

