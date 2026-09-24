"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SurveyPage {
    id: string;
    title: string;
    description: string;
}

interface SlideProps {
    pages: SurveyPage[];
    className?: string;
    onComplete?: () => void;
    onPageChange?: (pageIndex: number, page: SurveyPage) => void;
}

export default function Slide({
    pages,
    className,
    onComplete,
    onPageChange,
}: SlideProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const totalPages = pages.length;
    const currentPage = pages[currentIndex];
    const isFirstPage = currentIndex === 0;
    const isLastPage = currentIndex === totalPages - 1;
    const progress =
        totalPages > 0
            ? ((currentIndex + 1) / totalPages) * 100
            : 0;

    const goToPage = useCallback(
        (index: number) => {
            if (index < 0 || index >= totalPages) return;
            setCurrentIndex(index);
            onPageChange?.(index, pages[index]);
        },
        [totalPages, pages, onPageChange]
    );

    const goNext = useCallback(() => {
        if (isLastPage) {
            onComplete?.();
            return;
        }
        goToPage(currentIndex + 1);
    }, [currentIndex, goToPage, isLastPage, onComplete]);

    const goBack = useCallback(() => {
        goToPage(currentIndex - 1);
    }, [currentIndex, goToPage]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                goNext();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goNext]);

    if (!currentPage) {
        return null;
    }

    return (
        <div
            className={cn(
                "relative flex min-h-[70vh] w-full flex-col bg-background",
                className
            )}
        >
            <div className="fixed top-0 left-0 right-0 flex items-center justify-between border-t px-6 py-4 md:px-12 lg:px-24">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={goBack}
                    disabled={isFirstPage}
                    className="gap-2"
                >
                    <ArrowLeft className="size-4" />
                    Back
                </Button>

                <Button type="button" onClick={goNext} className="gap-2">
                    {isLastPage ? "Finish" : "Continue"}
                    {!isLastPage && <ArrowRight className="size-4" />}
                </Button>
            </div>
            {/* Progress bar */}
            <div className="absolute left-0 right-0 top-0 h-1 bg-muted">
                <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Page content */}
            <div className="flex flex-1 flex-col justify-center px-6 py-16 md:px-12 lg:px-24">
                <div
                    key={currentPage.id}
                    className="mx-auto w-full max-w-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                >
                    <p className="mb-4 text-sm font-medium text-muted-foreground">
                        {currentIndex + 1} / {totalPages}
                    </p>

                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
                        {currentPage.title}
                    </h1>

                    <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
                        {currentPage.description}
                    </p>
                </div>
            </div>

            {/* Navigation */}

        </div>
    );
}
