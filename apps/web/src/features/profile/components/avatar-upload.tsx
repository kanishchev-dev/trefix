"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
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
import { uploadAvatar } from "@/entities/avatar/api";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

import {
  AVATAR_ACCEPTED_INPUT_TYPES,
  loadImageFromFile,
  renderCroppedAvatar,
} from "../lib/avatar-image";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Avatar upload with an inline cropper.
 *
 * The image is cropped and downscaled to a square in the browser before it is
 * sent, so a multi-megabyte phone photo never leaves the device: the backend
 * receives a 512px WebP of a few dozen kilobytes and only validates the type
 * and the size.
 */
export function AvatarUpload(): ReactElement {
  const { t } = useI18n();
  const { user, setAvatarUrl } = useAuth();
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

  const releaseImageUrl = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
  }, []);

  // Leaving the page is not the only way the object URL has to go: the dialog
  // closing releases it too, through `closeDialog`.
  useEffect(() => releaseImageUrl, [releaseImageUrl]);

  if (!user) {
    return <span aria-hidden="true" />;
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || "U";

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
      notifyError(t("profile.avatar.invalidType"));
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
      notifyError(t("profile.avatar.readFailed"));
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
      const { avatarUrl } = await uploadAvatar(blob);

      setAvatarUrl(avatarUrl);
      notifySuccess(t("profile.toasts.avatarUpdated"));
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
        <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          {t("profile.avatar.change")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("profile.avatar.hint")}</p>
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
            <DialogTitle>{t("profile.avatar.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("profile.avatar.dialogDescription")}</DialogDescription>
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
                {t("profile.avatar.zoom")}
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
              {t("profile.avatar.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
