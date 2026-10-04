"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@workspace/ui/components/slider";
import { UploadIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

import { uploadOwnAvatar, uploadUserAvatar } from "../api";
import {
  AVATAR_ACCEPTED_INPUT_TYPES,
  loadImageFromFile,
  renderCroppedAvatar,
} from "../lib/avatar-image";
import { toInitials } from "../lib/initials";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type AvatarCropperProps = {
  /** Avatar shown until a new one is uploaded. */
  avatarUrl?: string | null;
  /** Label behind the placeholder initials and the image alt text. */
  name: string;
  /** Performs the upload; differs per caller because of the permissions each route requires. */
  upload: (file: Blob) => Promise<{ avatarUrl: string }>;
  /** Called after the backend has stored a new image. */
  onUploaded?: (avatarUrl: string) => void;
  disabled?: boolean;
};

/**
 * Avatar upload with an inline cropper.
 *
 * The image is cropped and downscaled to a square in the browser before it is
 * sent, so a multi-megabyte phone photo never leaves the device: the backend
 * receives a 512px WebP of a few dozen kilobytes and only validates the type
 * and the size.
 */
function AvatarCropper({
  avatarUrl: avatarUrlProp,
  name,
  upload,
  onUploaded,
  disabled,
}: AvatarCropperProps): ReactElement {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The cropper renders from an object URL, which has to be revoked explicitly.
  // It lives in a ref as well because a state updater would not run during the
  // unmount cleanup below.
  const imageUrlRef = useRef<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  // The preview updates on its own right after an upload, so the new avatar is
  // visible even when the caller keeps the record elsewhere and refetches it
  // later. The incoming prop is tracked next to it: navigating from one user to
  // another reuses this component, and a stale preview would show the previous
  // person's photo. Deriving it during render keeps the state in step without
  // an effect that would cascade a second render pass.
  const [preview, setPreview] = useState<{
    url: string | null;
    source: string | null | undefined;
  }>({ url: avatarUrlProp ?? null, source: avatarUrlProp });

  if (preview.source !== avatarUrlProp) {
    setPreview({ url: avatarUrlProp ?? null, source: avatarUrlProp });
  }

  const avatarUrl = preview.url;

  const releaseImageUrl = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
  }, []);

  // Leaving the page is not the only way the object URL has to go: the dialog
  // closing releases it too, through `closeDialog`.
  useEffect(() => releaseImageUrl, [releaseImageUrl]);

  const closeDialog = () => {
    setIsOpen(false);
    releaseImageUrl();
    setImageSrc(null);
    setImageElement(null);
    setCrop({ x: 0, y: 0 });
    setCroppedArea(null);
    setZoom(MIN_ZOOM);
  };

  const onSelectFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!(AVATAR_ACCEPTED_INPUT_TYPES as readonly string[]).includes(file.type)) {
      notifyError(t("avatar.invalidType"));
      return;
    }

    try {
      const image = await loadImageFromFile(file);

      releaseImageUrl();
      imageUrlRef.current = URL.createObjectURL(file);

      setImageSrc(imageUrlRef.current);
      setImageElement(image);
      setZoom(MIN_ZOOM);
      setIsOpen(true);
    } catch {
      notifyError(t("avatar.readFailed"));
    }
  };

  const onSave = async () => {
    if (!imageElement || !croppedArea) {
      return;
    }

    setIsUploading(true);

    try {
      // `croppedArea` is already in the natural pixel coordinates of the image:
      // react-easy-crop scales it internally when it reports the pixels.
      const blob = await renderCroppedAvatar(imageElement, croppedArea);
      const { avatarUrl: uploadedUrl } = await upload(blob);

      setPreview({ url: uploadedUrl, source: avatarUrlProp });
      onUploaded?.(uploadedUrl);
      notifySuccess(t("avatar.updated"));
      closeDialog();
    } catch (error) {
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-14">
        <AvatarImage src={avatarUrl ?? undefined} alt={name} />
        <AvatarFallback>{toInitials(name)}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          {t("avatar.change")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("avatar.hint")}</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={AVATAR_ACCEPTED_INPUT_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          void onSelectFile(event.target.files?.[0]);
          // Reset so picking the same file again after a cancelled crop works.
          event.target.value = "";
        }}
      />

      <Dialog
        open={isOpen}
        onOpenChange={(open) => (open ? setIsOpen(true) : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("avatar.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("avatar.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-muted">
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  restrictPosition
                  onCropChange={setCrop}
                  onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
                  onZoomChange={setZoom}
                  objectFit="contain"
                />
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Label className="shrink-0 text-xs text-muted-foreground">
                {t("avatar.zoom")}
              </Label>
              <Slider
                value={[zoom]}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                onValueChange={(value) =>
                  setZoom(Array.isArray(value) ? (value[0] ?? MIN_ZOOM) : value)
                }
              >
                <SliderControl>
                  <SliderTrack>
                    <SliderIndicator />
                    <SliderThumb />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>
              {t("common.actions.cancel")}
            </DialogClose>
            <Button type="button" onClick={onSave} disabled={isUploading}>
              {t("avatar.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Self-service variant for the profile page.
 *
 * Goes to `POST /avatars/me`, which needs `account.update` — an administrator
 * without `users.update` would be rejected by the admin route for their own
 * avatar.
 */
export function AvatarUpload(): ReactElement {
  const { user, setAvatarUrl } = useAuth();

  if (!user) {
    return <span aria-hidden="true" />;
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <AvatarCropper
      avatarUrl={user.avatarUrl}
      name={displayName}
      upload={uploadOwnAvatar}
      onUploaded={setAvatarUrl}
    />
  );
}

/**
 * Admin variant used on the user edit form.
 *
 * Goes to `POST /avatars/:userId`, which needs `users.update`.
 */
export function UserAvatarUpload({
  userId,
  avatarUrl,
  name,
  disabled,
}: {
  userId: string;
  avatarUrl?: string | null;
  name: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <AvatarCropper
      avatarUrl={avatarUrl}
      name={name}
      disabled={disabled}
      upload={(file) => uploadUserAvatar(userId, file)}
    />
  );
}