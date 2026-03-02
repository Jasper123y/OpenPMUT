import { Check, Loader } from 'lucide-react';
import clsx from 'clsx';

interface StepperProps {
  currentStep: number;
}

const steps = [
  { id: 0, name: 'Input', description: 'Upload shape + ECM params' },
  { id: 1, name: 'Running', description: 'ECM simulation in progress' },
  { id: 2, name: 'Output', description: 'View frequency response' },
];

export default function Stepper({ currentStep }: StepperProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex-1">
            <div className="flex items-center">
              {/* Step circle */}
              <div
                className={clsx(
                  'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  {
                    'border-primary-600 bg-primary-600': currentStep > step.id,
                    'border-primary-600 bg-white': currentStep === step.id && step.id !== 1,
                    'border-amber-500 bg-amber-50 animate-pulse': currentStep === step.id && step.id === 1,
                    'border-gray-300 bg-white': currentStep < step.id,
                  }
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-5 w-5 text-white" />
                ) : currentStep === step.id && step.id === 1 ? (
                  <Loader className="h-5 w-5 text-amber-600 animate-spin" />
                ) : (
                  <span
                    className={clsx('text-sm font-medium', {
                      'text-primary-600': currentStep >= step.id,
                      'text-gray-500': currentStep < step.id,
                    })}
                  >
                    {step.id + 1}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'h-0.5 flex-1 mx-2 transition-colors',
                    currentStep > step.id ? 'bg-primary-600' : 
                    currentStep === step.id && step.id === 1 ? 'bg-amber-300 animate-pulse' :
                    'bg-gray-200'
                  )}
                />
              )}
            </div>

            {/* Step label */}
            <div className="mt-2">
              <span
                className={clsx('text-sm font-medium', {
                  'text-primary-600': currentStep > step.id || (currentStep === step.id && step.id !== 1),
                  'text-amber-600 font-semibold': currentStep === step.id && step.id === 1,
                  'text-gray-500': currentStep < step.id,
                })}
              >
                {step.name}
              </span>
              <p className={clsx('text-xs', {
                'text-amber-500': currentStep === step.id && step.id === 1,
                'text-gray-400': !(currentStep === step.id && step.id === 1),
              })}>
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
