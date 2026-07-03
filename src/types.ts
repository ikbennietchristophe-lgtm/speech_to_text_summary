/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Recording {
  id: string;
  date: string;
  emailSubject: string;
  shortTitle: string;
  description: string;
  fullText: string;
  structuredSummary: string;
  status: 'Active' | 'Archived';
}

export interface SetupDbResponse {
  spreadsheetId: string;
  sheetName: string;
}
