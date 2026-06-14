import { parse, isValid, format } from 'date-fns';

export interface DateAmbiguityResult {
  isAmbiguous: boolean;
  interpretations: {
    label: string;
    value: string; // ISO date string
  }[];
}

/**
 * Checks if a date string in DD-MM-YYYY format is ambiguous.
 * A date is ambiguous if both day and month values are <= 12.
 * E.g., '04-05-2026' could be April 5th or May 4th.
 */
export function checkDateAmbiguity(dateStr: string): DateAmbiguityResult {
  const cleanStr = dateStr.trim();
  const pattern = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
  const match = cleanStr.match(pattern);
  
  if (!match) {
    return { isAmbiguous: false, interpretations: [] };
  }
  
  const num1 = parseInt(match[1], 10);
  const num2 = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  // If both values are <= 12 and different, it's ambiguous
  if (num1 <= 12 && num2 <= 12 && num1 !== num2) {
    const date1 = new Date(Date.UTC(year, num2 - 1, num1)); // DD-MM-YYYY (num1 = day, num2 = month)
    const date2 = new Date(Date.UTC(year, num1 - 1, num2)); // MM-DD-YYYY (num1 = month, num2 = day)
    
    return {
      isAmbiguous: true,
      interpretations: [
        {
          label: `Interpret as Day: ${num1}, Month: ${format(date1, 'MMMM')} ${year} (DD-MM-YYYY)`,
          value: date1.toISOString(),
        },
        {
          label: `Interpret as Day: ${num2}, Month: ${format(date2, 'MMMM')} ${year} (MM-DD-YYYY)`,
          value: date2.toISOString(),
        }
      ]
    };
  }
  
  return { isAmbiguous: false, interpretations: [] };
}

/**
 * Parses consistent formats (DD-MM-YYYY or Mar-14 contextual).
 */
export function parseCSVDate(dateStr: string, contextYear: number = 2026): Date {
  const cleanStr = dateStr.trim();
  
  // Try DD-MM-YYYY
  let parsed = parse(cleanStr, 'dd-MM-yyyy', new Date());
  if (isValid(parsed)) return parsed;
  
  // Try short month format like Mar-14 or 14-Mar
  parsed = parse(`${cleanStr}-${contextYear}`, 'MMM-d-yyyy', new Date());
  if (isValid(parsed)) return parsed;
  
  parsed = parse(`${cleanStr}-${contextYear}`, 'd-MMM-yyyy', new Date());
  if (isValid(parsed)) return parsed;
  
  throw new Error(`Invalid or unsupported date format: '${dateStr}'`);
}
