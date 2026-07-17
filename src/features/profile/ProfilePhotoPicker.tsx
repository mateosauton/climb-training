import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { validateAvatarFile, type AvatarFile } from "@/features/cloud/cloud-avatar";

type ProfilePhotoPickerProps = {
  file: AvatarFile | null;
  onFileChange: (file: AvatarFile) => void;
  onRemove?: () => void;
  currentUrl?: string | null;
  disabled?: boolean;
};

export function ProfilePhotoPicker({ file, onFileChange, onRemove, currentUrl = null, disabled = false }: ProfilePhotoPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl(currentUrl);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [currentUrl, file]);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] as AvatarFile | undefined;
    if (!nextFile) return;
    try {
      validateAvatarFile(nextFile);
      setError("");
      onFileChange(nextFile);
      event.currentTarget.value = "";
    } catch (failure) {
      setError((failure as { code?: string }).code === "avatar_too_large"
        ? "La foto debe pesar como máximo 5 MiB."
        : "Elegí una imagen JPEG, PNG o WebP.");
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="Vista previa de la foto de perfil" className="size-20 rounded-full border object-cover" />
        ) : (
          <div aria-hidden="true" className="size-20 rounded-full border bg-muted" />
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
            {previewUrl ? "Reemplazar foto" : "Elegir foto"}
          </Button>
          {previewUrl && onRemove ? (
            <Button type="button" variant="ghost" disabled={disabled} onClick={onRemove}>
              Eliminar foto
            </Button>
          ) : null}
        </div>
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-label="Foto de perfil"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={chooseFile}
      />
      <p className="text-xs text-muted-foreground">JPEG, PNG o WebP · máximo 5 MiB.</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
