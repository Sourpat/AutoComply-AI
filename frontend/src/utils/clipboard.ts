export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    if (textarea.parentNode === document.body) {
      document.body.removeChild(textarea);
    }
    return ok;
  } catch {
    return false;
  }
}
