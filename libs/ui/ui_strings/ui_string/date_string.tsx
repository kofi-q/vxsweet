import { format } from '@vx/libs/utils/src';
import { useLanguageContext } from '../language_context/language_context';
import { type FontProps } from '../../primitives/typography';

export interface DateStringProps extends FontProps {
  value: Date;
}
export function DateString({ value }: DateStringProps): JSX.Element {
  const languageContext = useLanguageContext();
  return (
    <span>
      {format.localeLongDate(value, languageContext?.currentLanguageCode)}
    </span>
  );
}
