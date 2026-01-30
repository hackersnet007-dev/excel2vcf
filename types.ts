export interface Contact {
  id: string;
  originalName: string;
  originalNumber: string;
  cleanedNumber: string;
  isValid: boolean;
}

export interface ProcessingStats {
  total: number;
  valid: number;
  invalid: number;
}

export enum Step {
  UPLOAD = 'UPLOAD',
  PREVIEW = 'PREVIEW',
  DOWNLOAD = 'DOWNLOAD'
}