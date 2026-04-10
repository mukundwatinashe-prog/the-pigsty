import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { FeedPurchaseForm } from '../../components/FeedPurchaseForm';

export default function FeedPurchasePage() {
  const { currentFarm } = useFarm();

  if (!currentFarm) {
    return <p className="text-gray-600">Select a farm first.</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/feed" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft size={16} /> Back to feed
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log feed purchase</h1>
        <p className="mt-1 text-sm text-gray-600">
          Total cost is calculated from your feed prices in Farm settings (per kg or per tonne). A receipt photo or PDF is required. The same record appears under
          Financials when the purchase date falls in your selected period.
        </p>
      </div>

      <FeedPurchaseForm farmId={currentFarm.id} currency={currentFarm.currency} variant="page" />
    </div>
  );
}
