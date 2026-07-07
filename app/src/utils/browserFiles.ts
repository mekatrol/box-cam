export const downloadTextFile = (filename: string, text: string, mimeType: string): void => {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Object URLs hold Blob memory until explicitly released. Deferring the
  // revoke keeps the download link valid long enough for the browser event.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const readTextFile = async (file: File): Promise<string> => {
  return await file.text();
};

export const projectFileName = (jobName: string): string => {
  const stem = jobName.trim() || 'finger-box';
  return stem.endsWith('.boxcreator') ? `${stem}.json` : `${stem}.boxcreator.json`;
};

export const ncFileName = (jobName: string): string => {
  const stem = jobName.trim() || 'finger-box';
  return `${stem}.nc`;
};
