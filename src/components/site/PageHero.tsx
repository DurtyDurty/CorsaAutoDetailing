import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Container, Eyebrow } from "@/components/ui/Section";
import type { WorkPhoto } from "@/config/photos";

/** Dark title band for inner pages. With `photo`, a real work photo sits beside the title (below it on phones). */
export function PageHero({
  eyebrow,
  title,
  lede,
  photo,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  photo?: WorkPhoto;
  children?: ReactNode;
}) {
  return (
    <div className="bg-asphalt text-chalk on-dark">
      <Container className={cn("py-14 sm:py-20", photo && "grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14")}>
        <div className="max-w-3xl">
          {eyebrow && <Eyebrow onDark>{eyebrow}</Eyebrow>}
          <h1 className="font-display text-5xl sm:text-6xl mt-4 text-balance">{title}</h1>
          {lede && <p className="mt-5 text-lg sm:text-xl text-chalk/75 leading-relaxed">{lede}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
        {photo && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg lg:aspect-[5/4]">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority
              sizes="(min-width: 1024px) 34rem, 100vw"
              className="object-cover"
              style={{ objectPosition: photo.focus ?? "center" }}
            />
          </div>
        )}
      </Container>
    </div>
  );
}
