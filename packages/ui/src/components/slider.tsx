"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

function Slider({
  className,
  ...props
}: SliderPrimitive.Root.Props<number | number[]>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "flex w-full touch-none items-center gap-3 select-none data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function SliderControl({
  className,
  ...props
}: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className={cn(
        "flex w-full touch-none items-center py-2 select-none",
        className
      )}
      {...props}
    />
  )
}

function SliderTrack({ className, ...props }: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      data-slot="slider-track"
      className={cn(
        "relative flex h-1.5 w-full grow items-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
}

function SliderIndicator({
  className,
  ...props
}: SliderPrimitive.Indicator.Props) {
  return (
    <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className={cn("absolute h-full rounded-full bg-primary", className)}
      {...props}
    />
  )
}

function SliderThumb({ className, ...props }: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        "size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none transition-shadow hover:ring-3 hover:ring-ring/30 focus-visible:ring-3 focus-visible:ring-ring/30 data-dragging:ring-3 data-dragging:ring-ring/30",
        className
      )}
      {...props}
    />
  )
}

export { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack }
