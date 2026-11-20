"use client";

import { useEffect, useRef } from "react";

import { markViewed } from "@/app/actions/sign";

/**
 * Moves the request from Sent to Viewed.
 *
 * It runs from an effect rather than during render, so the page stays a pure
 * read and the write happens once, after the client has really seen it.
 */
export function MarkViewed({ token }: { token: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void markViewed(token);
  }, [token]);

  return null;
}
