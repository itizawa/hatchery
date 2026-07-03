import { useRef } from "react";

export const ACCEPTED_MIME = "image/png,image/jpeg,image/webp,image/gif";

interface UseImageUploadOptions<TResult> {
  upload: (file: File) => Promise<TResult>;
  isPending: boolean;
  onSuccess?: (result: TResult) => void;
  onError?: (error: unknown) => void;
}

export function useImageUpload<TResult>({
  upload,
  isPending,
  onSuccess,
  onError,
}: UseImageUploadOptions<TResult>) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await upload(file);
      onSuccess?.(result);
    } catch (err) {
      onError?.(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isPending) handleClick();
    }
  };

  return { inputRef, handleClick, handleFileChange, handleKeyDown };
}
