import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Send } from 'lucide-react';
import { submitAuthedContact, submitPublicContact } from '../services/contact.service';
import { apiErrorMessage } from '../services/api';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  email: z.string().email('Valid email required'),
  phone: z.string().max(40).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
});

export type ContactFormValues = z.infer<typeof schema>;

type Props = {
  variant: 'landing' | 'settings';
  /** Required when variant is settings */
  farmId?: string;
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultEmail?: string;
  onSubmitted?: () => void;
};

export function ContactForm({
  variant,
  farmId,
  defaultFirstName = '',
  defaultLastName = '',
  defaultEmail = '',
  onSubmitted,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const isLanding = variant === 'landing';

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: defaultFirstName,
      lastName: defaultLastName,
      email: defaultEmail,
      phone: '',
      subject: '',
      message: '',
    },
  });

  const inputBase = isLanding
    ? 'w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-primary-200 outline-none focus:ring-2 focus:ring-white'
    : 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200';
  const labelClass = isLanding ? 'block text-sm font-medium text-primary-100' : 'block text-sm font-medium text-gray-700';

  const onSubmit = async (data: ContactFormValues) => {
    if (variant === 'settings' && !farmId) {
      toast.error('Farm not loaded');
      return;
    }
    setStatus('sending');
    try {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone?.trim() || undefined,
        subject: data.subject?.trim() || undefined,
        message: data.message?.trim() || undefined,
      };
      if (variant === 'landing') {
        await submitPublicContact(payload);
      } else {
        await submitAuthedContact(farmId!, payload);
      }
      toast.success('Message sent — we’ll get back to you.');
      form.reset({
        firstName: defaultFirstName,
        lastName: defaultLastName,
        email: defaultEmail,
        phone: '',
        subject: '',
        message: '',
      });
      onSubmitted?.();
    } catch (e: unknown) {
      setStatus('idle');
      toast.error(apiErrorMessage(e, 'Could not send message'));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 text-left sm:space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label htmlFor={`cf-fn-${variant}`} className={labelClass}>
            First name <span className="text-red-300">*</span>
          </label>
          <input
            id={`cf-fn-${variant}`}
            {...form.register('firstName')}
            autoComplete="given-name"
            className={`mt-1.5 ${inputBase}`}
          />
          {form.formState.errors.firstName && (
            <p className={`mt-1 text-xs ${isLanding ? 'text-amber-200' : 'text-red-600'}`}>
              {form.formState.errors.firstName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`cf-ln-${variant}`} className={labelClass}>
            Last name <span className="text-red-300">*</span>
          </label>
          <input
            id={`cf-ln-${variant}`}
            {...form.register('lastName')}
            autoComplete="family-name"
            className={`mt-1.5 ${inputBase}`}
          />
          {form.formState.errors.lastName && (
            <p className={`mt-1 text-xs ${isLanding ? 'text-amber-200' : 'text-red-600'}`}>
              {form.formState.errors.lastName.message}
            </p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor={`cf-em-${variant}`} className={labelClass}>
          Email address <span className="text-red-300">*</span>
        </label>
        <input
          id={`cf-em-${variant}`}
          type="email"
          {...form.register('email')}
          autoComplete="email"
          className={`mt-1.5 ${inputBase}`}
        />
        {form.formState.errors.email && (
          <p className={`mt-1 text-xs ${isLanding ? 'text-amber-200' : 'text-red-600'}`}>
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`cf-ph-${variant}`} className={labelClass}>
          Phone <span className="font-normal opacity-80">(optional)</span>
        </label>
        <input
          id={`cf-ph-${variant}`}
          type="tel"
          {...form.register('phone')}
          autoComplete="tel"
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor={`cf-sub-${variant}`} className={labelClass}>
          Subject <span className="font-normal opacity-80">(optional)</span>
        </label>
        <input id={`cf-sub-${variant}`} {...form.register('subject')} className={`mt-1.5 ${inputBase}`} />
      </div>
      <div>
        <label htmlFor={`cf-msg-${variant}`} className={labelClass}>
          Message <span className="font-normal opacity-80">(optional)</span>
        </label>
        <textarea
          id={`cf-msg-${variant}`}
          {...form.register('message')}
          rows={4}
          className={`mt-1.5 ${inputBase} resize-y min-h-[100px]`}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className={
          isLanding
            ? 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60'
            : 'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50'
        }
      >
        {status === 'sending' ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-4" />}
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
