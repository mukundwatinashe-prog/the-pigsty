import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  PiggyBank,
} from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { track } from '../../lib/analytics';
import { pigService } from '../../services/pig.service';
import { farmService } from '../../services/farm.service';
import type { ImportPreviewRow } from '../../types';

type Step = 1 | 2 | 3;

interface ValidateImportResponse {
  total: number;
  valid: number;
  errors: number;
  preview: ImportPreviewRow[];
}

interface ConfirmImportResponse {
  imported: number;
  total: number;
  errors: number;
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1 as const, label: 'Download template' },
    { n: 2 as const, label: 'Upload file' },
    { n: 3 as const, label: 'Review & confirm' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 mb-10">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shrink-0 transition ${
                current >= s.n
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {current > s.n ? <Check size={18} strokeWidth={2.5} /> : s.n}
            </div>
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold truncate ${
                  current >= s.n ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                Step {s.n}
              </p>
              <p className="text-xs text-gray-500 truncate">{s.label}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight
              className="hidden sm:block mx-3 text-gray-300 shrink-0"
              size={20}
              aria-hidden
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PigImportPage() {
  const queryClient = useQueryClient();
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;

  const [step, setStep] = useState<Step>(1);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [validateMeta, setValidateMeta] = useState<{ total: number; valid: number; errors: number } | null>(
    null,
  );
  const [importSummary, setImportSummary] = useState<ConfirmImportResponse | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const { data: farmDash } = useQuery({
    queryKey: ['farm-dashboard', farmId],
    queryFn: () => farmService.getById(farmId!),
    enabled: !!farmId,
  });

  const downloadMutation = useMutation({
    mutationFn: () => pigService.downloadTemplate(farmId!),
    onSuccess: () => toast.success('Template download started'),
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Download failed');
    },
  });

  const { mutate: runValidate, isPending: isValidating } = useMutation({
    mutationFn: (file: File) => pigService.validateImport(farmId!, file) as Promise<ValidateImportResponse>,
    onSuccess: (data) => {
      setPreviewRows(data.preview ?? []);
      setValidateMeta({ total: data.total, valid: data.valid, errors: data.errors });
      setStep(3);
      toast.success(`Parsed ${data.total} row(s)`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Validation failed');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => pigService.confirmImport(farmId!, previewRows) as Promise<ConfirmImportResponse>,
    onSuccess: (data) => {
      setImportSummary(data);
      if (data.imported > 0) track('import_completed', { imported: data.imported });
      toast.success(`Imported ${data.imported} pig(s)`);
      queryClient.invalidateQueries({ queryKey: ['pigs'] });
      queryClient.invalidateQueries({ queryKey: ['pens'] });
    },
    onError: (err: { response?: { status?: number; data?: { message?: string } } }) => {
      if (err.response?.status === 402) {
        track('plan_limit_hit', { context: 'import' });
        toast.error(
          `${err.response?.data?.message || 'Free tier limit reached'}. Open Billing in the sidebar to upgrade.`,
          { duration: 6500 },
        );
        return;
      }
      toast.error(err.response?.data?.message ?? 'Import failed');
    },
  });

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file || !farmId) return;
      setLastFileName(file.name);
      runValidate(file);
    },
    [farmId, runValidate],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    disabled: !farmId || isValidating,
  });

  const resetFlow = () => {
    setStep(1);
    setPreviewRows([]);
    setValidateMeta(null);
    setImportSummary(null);
    setLastFileName(null);
  };

  const validCount = previewRows.filter((r) => r.valid).length;
  const canConfirm = validCount > 0 && !confirmMutation.isPending;

  if (!currentFarm) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <p className="text-gray-600 mb-4">Select a farm before importing pigs.</p>
        <Link to="/farms" className="text-primary-600 font-medium hover:text-primary-700">
          Choose farm
        </Link>
      </div>
    );
  }

  if (importSummary) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to="/pigs"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 text-sm font-medium"
        >
          <ArrowLeft size={18} />
          Back to pigs
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-accent-500 to-accent-600 px-8 py-10 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Check size={32} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold">Import complete</h1>
            <p className="text-accent-100 mt-1 text-sm">Your spreadsheet has been processed.</p>
          </div>
          <div className="p-8 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">{importSummary.imported}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Imported</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">{importSummary.total}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Total rows</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-2xl font-bold text-amber-900">{importSummary.errors}</p>
                <p className="text-xs text-amber-800 uppercase tracking-wide mt-1">Skipped</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={resetFlow}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-800 font-medium hover:bg-gray-50 transition"
              >
                <RefreshCw size={18} />
                Import another file
              </button>
              <Link
                to="/pigs"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition text-center"
              >
                <PiggyBank size={18} />
                View pigs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/pigs"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 text-sm font-medium mb-2"
          >
            <ArrowLeft size={18} />
            Back to pigs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="text-primary-600" size={28} />
            Import pigs from Excel
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Download the template, fill in your data, then upload a .xlsx file for {currentFarm.name}.
          </p>
        </div>
      </div>

      {farmDash?.billing?.plan === 'FREE' && farmDash.billing.atLimit && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-medium">Free tier pig limit reached.</span> Importing more pigs is blocked until you{' '}
          <Link to="/billing" className="font-medium text-red-800 underline hover:no-underline">
            upgrade the farm
          </Link>
          .
        </div>
      )}
      {farmDash?.billing?.plan === 'FREE' && farmDash.billing.nearLimit && !farmDash.billing.atLimit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          You are near the Free tier limit ({farmDash.billing.pigCount} / {farmDash.billing.pigLimit ?? '—'} pigs).
          Large imports may fail if they exceed the cap —{' '}
          <Link to="/billing" className="font-medium text-amber-900 underline hover:no-underline">
            see billing
          </Link>
          .
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-10">
        <StepIndicator current={step} />

        {step === 1 && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto">
              <Download className="text-primary-600" size={36} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Download the import template</h2>
              <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                The spreadsheet includes column headers and an example row. Use the &quot;Pig Data&quot; sheet
                for your records (up to 5,000 rows).
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow-md shadow-primary-200 transition disabled:opacity-60"
            >
              <Download size={20} />
              {downloadMutation.isPending ? 'Preparing…' : 'Download template'}
            </button>
            <div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-primary-600 font-medium hover:text-primary-700"
              >
                I already have the template — continue to upload
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">Upload your .xlsx file</h2>
              <p className="text-gray-600 text-sm mt-1">Drag and drop or click to select one file.</p>
            </div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${
                isDragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50/80'
              } ${isValidating ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto text-gray-400 mb-3" size={40} />
              {isValidating ? (
                <p className="text-gray-600 font-medium">Validating file…</p>
              ) : (
                <>
                  <p className="text-gray-900 font-medium">
                    {isDragActive ? 'Drop the file here' : 'Drop .xlsx here or click to browse'}
                  </p>
                  <p className="text-gray-500 text-xs mt-2">Only .xlsx files are accepted</p>
                </>
              )}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to download step
              </button>
            </div>
          </div>
        )}

        {step === 3 && validateMeta && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Review import</h2>
                {lastFileName && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    File: <span className="font-medium text-gray-700">{lastFileName}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {validateMeta.total} rows
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-800">
                  {validateMeta.valid} valid
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {validateMeta.errors} invalid
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 text-left text-gray-600 border-b border-gray-200">
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Row</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Status</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Tag</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Breed</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Stage</th>
                    <th className="px-3 py-3 font-medium min-w-[200px]">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.map((row) => (
                    <tr
                      key={row.row}
                      className={row.valid ? 'bg-white hover:bg-gray-50/80' : 'bg-red-50/90 hover:bg-red-50'}
                    >
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.row}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-800">
                            <Check size={12} />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-900">
                            <AlertCircle size={12} />
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                        {String(row.data.tagNumber ?? '—')}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap max-w-[100px] truncate">
                        {String(row.data.breed ?? '—')}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                        {String(row.data.stage ?? '—')}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {row.errors.length === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {row.errors.map((e, idx) => (
                              <li key={idx} className="text-xs text-red-800 flex gap-1">
                                <span className="font-medium shrink-0">{e.field}:</span>
                                <span>{e.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setPreviewRows([]);
                  setValidateMeta(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Upload a different file
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => confirmMutation.mutate()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmMutation.isPending ? 'Importing…' : `Import valid records (${validCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
