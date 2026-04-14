"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { MediaPickerPopover } from "./MediaPickerPopover";

type JitsiApi = {
  addEventListener: (event: string, handler: () => void) => void;
  dispose: () => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        parentNode: HTMLElement;
        userInfo?: { displayName?: string };
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      }
    ) => JitsiApi;
  }
}

type ReactionItem = { emoji: string; count: number; userIds: string[] };

type ReplyTo = { id: string; content: string; messageType?: string; senderName: string; isDeleted?: boolean };

type Message = {
  id: string;
  content: string;
  senderId: string;
  sentAt: string;
  senderName: string;
  isRead?: boolean;
  messageType?: string;
  isDeleted?: boolean;
  hiddenByMe?: boolean;
  reactions?: ReactionItem[];
  replyTo?: ReplyTo;
};

type Props = {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl?: string | null;
  otherUserStatus?: "online" | "offline";
  otherUserLastSeen?: string | null;
  messages: Message[];
};

const POLL_INTERVAL_MS = 1500;
type IncomingCall = { mode: "audio" | "video"; fromUserId: string } | null;

function getAvatarUrl(seed: string): string {
  if (!seed) seed = "user";
  return `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(seed)}&backgroundColor=10b981,14b8a6,0d9488&size=80`;
}

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "منذ لحظات";
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return d.toLocaleDateString("ar-SA");
}

function getDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const key = getDateKey(iso);
  const todayKey = getDateKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday.toISOString());
  if (key === todayKey) return "اليوم";
  if (key === yesterdayKey) return "أمس";
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
}

export function ChatClient({
  conversationId,
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserAvatarUrl = null,
  otherUserStatus = "online",
  otherUserLastSeen = null,
  messages: initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
  const [messageMenuMessageId, setMessageMenuMessageId] = useState<string | null>(null);
  const [deleteSubMenuMessageId, setDeleteSubMenuMessageId] = useState<string | null>(null);
  const [reactionBarMessageId, setReactionBarMessageId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [imagePreview, setImagePreview] = useState<{ dataUrl: string; file?: File } | null>(null);
  const [imagePreviewCaption, setImagePreviewCaption] = useState("");
  const [cameraChoiceOpen, setCameraChoiceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ bottom: 80, left: 16 });
  const [inputAreaTop, setInputAreaTop] = useState<number>(0);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [callOpen, setCallOpen] = useState(false);
  const [callMode, setCallMode] = useState<"audio" | "video">("audio");
  const [callError, setCallError] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{ x: number; messageId: string } | null>(null);
  const SWIPE_REPLY_THRESHOLD = 56;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const optionsRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const attachBtnRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const attachPanelRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);

  const avatarUrl = otherUserAvatarUrl || getAvatarUrl(otherUserId || otherUserName);

  const [displayStatus, setDisplayStatus] = useState<"online" | "offline">(otherUserStatus);
  const [displayLastSeen, setDisplayLastSeen] = useState<string | null>(otherUserLastSeen ?? null);

  useEffect(() => {
    setDisplayStatus(otherUserStatus);
    setDisplayLastSeen(otherUserLastSeen ?? null);
  }, [otherUserStatus, otherUserLastSeen]);

  const updatePopoverPosition = useCallback(() => {
    if (emojiOpen && inputAreaRef.current) {
      const rect = inputAreaRef.current.getBoundingClientRect();
      setInputAreaTop(rect.top);
    }
    if (attachOpen && attachBtnRef.current) {
      const rect = attachBtnRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const left = Math.max(8, Math.min(rect.left, vw - 216));
      setPopoverPosition({ bottom: window.innerHeight - rect.top + 8, left });
    }
  }, [emojiOpen, attachOpen]);

  useLayoutEffect(() => {
    if (!emojiOpen && !attachOpen) return;
    updatePopoverPosition();
  }, [emojiOpen, attachOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!emojiOpen && !attachOpen) return;
    const onResize = () => updatePopoverPosition();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [emojiOpen, attachOpen, updatePopoverPosition]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileLayout(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      atBottomRef.current = true;
      setHasNewMessages(false);
    }
  }, []);

  // تحسين تجربة الكيبورد على الهاتف: رفع آخر الرسائل مع ارتفاع الكيبورد.
  useEffect(() => {
    if (!isMobileLayout || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(inset);
      if (document.activeElement === inputRef.current) {
        requestAnimationFrame(() => scrollToBottom("auto"));
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isMobileLayout, scrollToBottom]);

  const switchToKeyboard = useCallback(() => {
    setEmojiOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const openCall = useCallback((mode: "audio" | "video") => {
    setCallError(null);
    setCallMode(mode);
    setCallOpen(true);
  }, []);

  const closeCall = useCallback(() => {
    setCallOpen(false);
    setCallError(null);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
  }, []);

  const startCall = useCallback(
    async (mode: "audio" | "video") => {
      try {
        await fetch("/api/chat/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, action: "start", mode }),
        });
      } catch {
        // لا نمنع فتح الاتصال إذا فشل إرسال الإشعار للطرف الآخر
      }
      openCall(mode);
    },
    [conversationId, openCall]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await fetch("/api/chat/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action: "accept" }),
      });
    } catch {}
    setIncomingCall(null);
    openCall(incomingCall.mode);
  }, [incomingCall, conversationId, openCall]);

  const declineIncomingCall = useCallback(async () => {
    try {
      await fetch("/api/chat/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action: "decline" }),
      });
    } catch {}
    setIncomingCall(null);
  }, [conversationId]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // حتى لو فشل الطلب، نحول المستخدم لصفحة الدخول
    }
    window.location.href = "/login";
  }, [isLoggingOut]);

  useEffect(() => {
    if (!callOpen) return;
    let cancelled = false;

    const ensureScript = async () => {
      if (window.JitsiMeetExternalAPI) return;
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-jitsi-external-api="1"]');
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("script_load_failed")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://meet.jit.si/external_api.js";
        script.async = true;
        script.dataset.jitsiExternalApi = "1";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("script_load_failed"));
        document.body.appendChild(script);
      });
    };

    const initCall = async () => {
      try {
        await ensureScript();
        if (cancelled || !callContainerRef.current) return;
        if (!window.JitsiMeetExternalAPI) {
          setCallError("تعذر تهيئة الاتصال. جرّب مرة أخرى.");
          return;
        }
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
          jitsiApiRef.current = null;
        }
        callContainerRef.current.innerHTML = "";
        const roomId = `privatechat-${conversationId}`;
        const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
          roomName: roomId,
          parentNode: callContainerRef.current,
          userInfo: { displayName: otherUserName ? `محادثة مع ${otherUserName}` : "مكالمة" },
          configOverwrite: {
            prejoinConfig: { enabled: false },
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: callMode === "audio",
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        });
        jitsiApiRef.current = api;
        api.addEventListener("readyToClose", () => {
          setCallOpen(false);
          if (jitsiApiRef.current) {
            jitsiApiRef.current.dispose();
            jitsiApiRef.current = null;
          }
        });
      } catch {
        setCallError("تعذر فتح خدمة الاتصال. تحقق من الشبكة وحاول مجددًا.");
      }
    };

    initCall();
    return () => {
      cancelled = true;
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [callOpen, callMode, conversationId, otherUserName]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      if (typeof data.otherUserTyping === "boolean") {
        setOtherUserTyping(data.otherUserTyping);
      }
      if (data.otherUserStatus === "online" || data.otherUserStatus === "offline") {
        setDisplayStatus(data.otherUserStatus);
      }
      if (data.otherUserLastSeen !== undefined) {
        setDisplayLastSeen(data.otherUserLastSeen);
      }
      if (data.incomingCall) {
        setIncomingCall(data.incomingCall as IncomingCall);
      } else {
        setIncomingCall(null);
      }
    } catch {
      // تجاهل أخطاء الشبكة أثناء الاستطلاع
    }
  }, [conversationId]);

  const sendTypingIndicator = useCallback(() => {
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    if (!inputValue.trim()) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator();
      typingTimeoutRef.current = null;
    }, 400);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputValue, sendTypingIndicator]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    const prevLen = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    if (messages.length === 0) return;
    if (messages.length > prevLen) {
      if (atBottomRef.current) {
        scrollToBottom(prevLen === 0 ? "auto" : "smooth");
      } else {
        setHasNewMessages(true);
      }
    }
  }, [messages.length, scrollToBottom]);

  const handleMessagesScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottomRef.current = nearBottom;
    if (nearBottom) setHasNewMessages(false);
  }, []);

  useEffect(() => {
    function handlePointerDownOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (optionsRef.current && !optionsRef.current.contains(target)) {
        setOptionsOpen(false);
      }
      const insideInputArea = inputAreaRef.current?.contains(target);
      const insideEmojiPanel = emojiPanelRef.current?.contains(target);
      const insideAttachPanel = attachPanelRef.current?.contains(target);
      if (!insideInputArea && !insideEmojiPanel && !insideAttachPanel) {
        setEmojiOpen(false);
        setAttachOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
    };
  }, []);

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSendError(null);
    const content = inputValue.trim();
    if (!content || isSending) return;
    // نحافظ على ظهور الكيبورد بعد الإرسال (سلوك مشابه واتساب).
    requestAnimationFrame(() => inputRef.current?.focus());

    const replyingTo = replyToMessageId;
    setIsSending(true);
    setInputValue("");
    setReplyToMessageId(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content, replyToMessageId: replyingTo ?? undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error ?? "فشل الإرسال");
        setInputValue(content);
        setReplyToMessageId(replyingTo);
        return;
      }
      setMessages((prev) => [...prev, data]);
    } catch {
      setSendError("حدث خطأ في الإرسال");
      setInputValue(content);
      setReplyToMessageId(replyingTo);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function insertEmoji(emoji: string) {
    setInputValue((v) => v + emoji);
    inputRef.current?.focus();
    setEmojiOpen(false);
  }

  async function sendSticker(url: string) {
    if (isSending) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content: url, messageType: "sticker" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { ...data, messageType: "sticker" }]);
      } else {
        setSendError(data.error ?? "فشل إرسال الملصق");
      }
    } catch {
      setSendError("حدث خطأ في الإرسال");
    } finally {
      setIsSending(false);
    }
  }

  async function sendGif(content: string) {
    if (isSending) return;
    const isUrl = content.startsWith("http");
    const bodyContent = isUrl ? content : (content.includes(",") ? content.split(",")[1]! : content);
    setIsSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content: bodyContent, messageType: "gif" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { ...data, messageType: "gif" }]);
      } else {
        setSendError(data.error ?? "فشل إرسال GIF");
      }
    } catch {
      setSendError("حدث خطأ في الإرسال");
    } finally {
      setIsSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length > 0) {
          setAudioBlob(new Blob(chunksRef.current, { type: mimeType }));
        } else {
          setAudioBlob(null);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      setAudioBlob(null);
    } catch (err) {
      console.error(err);
      alert("تعذّر الوصول إلى الميكروفون");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
  }

  useEffect(() => {
    if (!isRecording) return;
    recordingIntervalRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording && mediaRecorderRef.current === null && audioBlob === null && recordingSeconds > 0) {
      setRecordingSeconds(0);
    }
  }, [isRecording, audioBlob, recordingSeconds]);

  function sendVoiceMessage() {
    if (isSendingVoice) return;
    setIsSendingVoice(true);
    stopRecording();
  }

  useEffect(() => {
    if (!audioBlob || !isSendingVoice) return;
    const blob = audioBlob;
    setAudioBlob(null);
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string)?.split(",")[1];
      if (!base64) {
        setIsSendingVoice(false);
        return;
      }
      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, content: base64, messageType: "voice" }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessages((prev) => [...prev, { ...data, messageType: "voice" }]);
        } else {
          setSendError(data.error ?? "فشل إرسال الصوت");
        }
      } catch {
        setSendError("حدث خطأ في الإرسال");
      }
      setIsSendingVoice(false);
    };
  }, [audioBlob, isSendingVoice, conversationId]);

  function cancelVoiceMessage() {
    stopRecording();
    setAudioBlob(null);
    setRecordingSeconds(0);
  }

  function handleViewProfile() {
    setOptionsOpen(false);
    // يمكن ربطه بصفحة الملف الشخصي لاحقاً
    alert("عرض الملف الشخصي – قريباً");
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const valid = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type);
    if (!valid) {
      setAvatarMessage("نوع الملف غير مدعوم (jpeg, png, webp)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMessage("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }
    setAvatarMessage(null);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.set("avatar", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarMessage(data.error ?? "فشل تحديث الصورة");
        return;
      }
      setAvatarMessage("تم تحديث صورتك بنجاح");
      setTimeout(() => setAvatarMessage(null), 3000);
    } catch {
      setAvatarMessage("حدث خطأ أثناء الرفع");
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleSearchInChat() {
    setOptionsOpen(false);
    setSearchOpen(true);
  }

  function openClearConfirm() {
    setOptionsOpen(false);
    setClearConfirmOpen(true);
  }

  async function handleClearConversation(forMeOnly: boolean) {
    setClearConfirmOpen(false);
    try {
      const url = `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}${forMeOnly ? "&forMeOnly=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
      } else {
        const data = await res.json();
        alert(data.error ?? "فشل مسح المحادثة");
      }
    } catch {
      alert("حدث خطأ أثناء المسح");
    }
  }

  async function handleDeleteMediaOnly() {
    setOptionsOpen(false);
    if (!confirm("حذف جميع الوسائط (صور وصوت) من المحادثة؟ سيتم إخفاؤها من عندك فقط.")) return;
    try {
      const res = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&mediaOnly=true`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            ["voice", "image", "sticker", "gif"].includes(m.messageType ?? "")
              ? { ...m, hiddenByMe: true }
              : m
          )
        );
      } else {
        const data = await res.json();
        alert(data.error ?? "فشل حذف الوسائط");
      }
    } catch {
      alert("حدث خطأ أثناء الحذف");
    }
  }

  function enterSelectionMode() {
    setOptionsOpen(false);
    setSelectionMode(true);
    setSelectedMessageIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/chat/messages/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "for_me" }),
          })
        )
      );
      setMessages((prev) =>
        prev.map((m) => (selectedMessageIds.has(m.id) ? { ...m, hiddenByMe: true } : m))
      );
      exitSelectionMode();
    } catch {
      alert("حدث خطأ أثناء الحذف");
    }
  }

  function handleBulkCopy() {
    const texts = Array.from(selectedMessageIds)
      .map((id) => messages.find((m) => m.id === id))
      .filter((m) => m && !m.isDeleted && !m.hiddenByMe && m.messageType === "text" && m.content)
      .map((m) => m!.content);
    if (texts.length === 0) return;
    navigator.clipboard.writeText(texts.join("\n\n"));
    exitSelectionMode();
  }

  function openCamera(facing: "user" | "environment") {
    setCameraChoiceOpen(false);
    setCameraFacingMode(facing);
    setCameraError(null);
    setCameraOpen(true);
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
    setCameraError(null);
  }

  useEffect(() => {
    if (!cameraOpen) return;
    let stream: MediaStream | null = null;
    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("الكاميرا غير متاحة");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        setCameraStream(stream);
        setCameraError(null);
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "يجب السماح بالوصول للكاميرا"
            : "تعذر فتح الكاميرا";
        setCameraError(msg);
      }
    };
    run();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOpen, cameraFacingMode]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  function captureFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraStream) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImagePreview({ dataUrl });
    setImagePreviewCaption("");
    closeCamera();
  }

  function switchCameraFacing() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }

  function useCameraFallback() {
    closeCamera();
    cameraInputRef.current?.click();
  }

  function handleExportConversation() {
    setOptionsOpen(false);
    const text = messages
      .filter((m) => !m.isDeleted && !m.hiddenByMe && m.messageType === "text")
      .map((m) => {
        const time = new Date(m.sentAt).toLocaleString("ar-SA");
        return `[${time}] ${m.senderName}: ${m.content}`;
      })
      .join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `محادثة-${otherUserName}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openMessageMenu(messageId: string) {
    setMessageMenuMessageId(messageId);
    setDeleteSubMenuMessageId(null);
  }

  function closeMessageMenu() {
    setMessageMenuMessageId(null);
    setDeleteSubMenuMessageId(null);
  }

  async function handleDeleteMessage(messageId: string, type: "for_me" | "for_everyone") {
    closeMessageMenu();
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, ...(type === "for_me" ? { hiddenByMe: true } : { isDeleted: true }) }
              : m
          )
        );
      } else {
        alert(data.error ?? "فشل الحذف");
      }
    } catch {
      alert("حدث خطأ أثناء الحذف");
    }
  }

  function copyMessageText(messageId: string) {
    const m = messages.find((msg) => msg.id === messageId);
    if (!m || m.isDeleted || m.hiddenByMe || m.messageType !== "text") return;
    navigator.clipboard.writeText(m.content).then(() => {
      closeMessageMenu();
    });
  }

  function startReply(messageId: string) {
    setReplyToMessageId(messageId);
    inputRef.current?.focus();
  }

  function cancelReply() {
    setReplyToMessageId(null);
  }

  function handleForwardMessage(messageId: string) {
    const m = messages.find((msg) => msg.id === messageId);
    closeMessageMenu();
    if (!m || m.isDeleted || m.hiddenByMe) return;
    if (m.messageType === "text" && m.content) {
      setInputValue(m.content);
      inputRef.current?.focus();
    }
    // الوسائط: يمكن إضافة نسخ/إعادة إرسال لاحقاً
  }

  function handleLongPress(messageId: string) {
    const m = messages.find((msg) => msg.id === messageId);
    if (m?.isDeleted || m?.hiddenByMe) return;
    setReactionBarMessageId(messageId);
  }

  const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

  async function handleAddReaction(messageId: string, emoji: string) {
    setReactionBarMessageId(null);
    const msg = messages.find((m) => m.id === messageId);
    const myReaction = msg?.reactions?.find((r) => r.userIds.includes(currentUserId));
    const isToggleOff = myReaction?.emoji === emoji;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ?? [];
        const withoutMe = reactions
          .map((r) => (r.userIds.includes(currentUserId) ? { ...r, count: r.count - 1, userIds: r.userIds.filter((id) => id !== currentUserId) } : r))
          .filter((r) => r.count > 0);
        if (isToggleOff) return { ...m, reactions: withoutMe };
        const addTo = withoutMe.find((r) => r.emoji === emoji);
        const next = addTo
          ? withoutMe.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, currentUserId] } : r))
          : [...withoutMe, { emoji, count: 1, userIds: [currentUserId] }];
        return { ...m, reactions: next };
      })
    );
    try {
      if (isToggleOff) {
        await fetch(`/api/chat/messages/${messageId}/reaction`, { method: "DELETE" });
      } else {
        await fetch(`/api/chat/messages/${messageId}/reaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
      }
    } catch {
      fetchMessages();
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-[480px] mx-auto overflow-hidden chat-page text-[#111B21] bg-[var(--chat-bg)]">
      {/* الهيدر — نظيف وثابت */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 min-h-[56px] bg-[#F0F2F5] safe-area-inset z-20" style={{ boxShadow: "var(--shadow-header)" }}>
        {reactionBarMessageId ? (
          <>
            <button
              type="button"
              onClick={() => setReactionBarMessageId(null)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#54656F] transition-colors -m-1"
              aria-label="إلغاء"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="flex-1 text-[#667781] text-sm">رسالة محددة</span>
            <button
              type="button"
              onClick={() => {
                const id = reactionBarMessageId;
                setReactionBarMessageId(null);
                if (id) {
                  openMessageMenu(id);
                  setDeleteSubMenuMessageId(id);
                }
              }}
              className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50/80 text-sm font-medium"
            >
              حذف
            </button>
            <button
              type="button"
              onClick={() => {
                const id = reactionBarMessageId;
                if (id) handleForwardMessage(id);
                setReactionBarMessageId(null);
              }}
              className="px-3 py-2 rounded-lg text-[#111B21] hover:bg-white/80 text-sm font-medium flex items-center gap-1"
            >
              <span className="text-[#54656F]">↗</span>
              تحويل
            </button>
          </>
        ) : (
          <>
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#54656F] transition-colors -m-1"
          aria-label="الرئيسية"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#E9EDEF] ring-1 ring-black/5">
              <Image
                src={avatarUrl}
                alt=""
                width={40}
                height={40}
                className="w-full h-full object-cover"
                unoptimized
                loading="eager"
                priority
              />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-[#111B21] truncate text-[16px] leading-tight">{otherUserName}</h1>
            <p className="text-[#667781] text-[13px] flex items-center gap-1.5 mt-0.5">
              {displayStatus === "online" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-pulse" />
                  متصل الآن
                </>
              ) : displayLastSeen ? (
                <>آخر ظهور {formatLastSeen(displayLastSeen)}</>
              ) : (
                <>آخر ظهور منذ قليل</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => startCall("audio")}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#54656F] transition-colors"
            aria-label="اتصال صوتي"
            title="اتصال صوتي"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => startCall("video")}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#54656F] transition-colors"
            aria-label="اتصال فيديو"
            title="اتصال فيديو"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-60"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 20H7a2 2 0 01-2-2V6a2 2 0 012-2h6" />
            </svg>
          </button>
          <div className="relative" ref={optionsRef}>
            <button
              type="button"
              onClick={() => setOptionsOpen((v) => !v)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#54656F] transition-colors"
              aria-label="قائمة الخيارات"
              title="قائمة الخيارات"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {optionsOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-white py-1.5 z-30 shadow-lg border border-black/5">
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => {
                    setOptionsOpen(false);
                    avatarInputRef.current?.click();
                  }}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3 disabled:opacity-60"
                >
                  <span className="text-[#54656F]">🖼</span>
                  {avatarUploading ? "جاري الرفع..." : "تغيير صورتي الشخصية"}
                </button>
                <button
                  type="button"
                  onClick={handleViewProfile}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                >
                  <span className="text-[#54656F]">👤</span>
                  عرض الملف الشخصي
                </button>
                <button
                  type="button"
                  onClick={handleSearchInChat}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                >
                  <span className="text-[#54656F]">🔍</span>
                  بحث في المحادثة
                </button>
                <button
                  type="button"
                  onClick={enterSelectionMode}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                >
                  <span className="text-[#54656F]">☑</span>
                  تحديد رسائل
                </button>
                <button
                  type="button"
                  onClick={openClearConfirm}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-red-600 hover:bg-red-50/80 flex items-center gap-3"
                >
                  <span>🗑️</span>
                  مسح المحادثة
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMediaOnly}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                >
                  <span className="text-[#54656F]">🖼</span>
                  حذف الوسائط فقط
                </button>
                <button
                  type="button"
                  onClick={handleExportConversation}
                  className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                >
                  <span className="text-[#54656F]">📤</span>
                  تصدير المحادثة
                </button>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </header>

      {avatarMessage && (
        <p className={`text-center text-[13px] py-2 px-3 ${avatarMessage.startsWith("تم") ? "text-[#00A884] bg-[#E7F9F2]" : "text-red-600 bg-red-50/80"}`}>
          {avatarMessage}
        </p>
      )}

      {/* شريط التحديد المتعدد */}
      {selectionMode && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-[#E7F9F2] border-b border-[#00A884]/20">
          <span className="text-[#111B21] text-[14px] font-medium">
            {selectedMessageIds.size > 0
              ? `${selectedMessageIds.size} ${selectedMessageIds.size === 1 ? "رسالة محددة" : "رسائل محددة"}`
              : "حدّد رسائل"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedMessageIds.size === 0}
              className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none text-[13px]"
            >
              حذف
            </button>
            <button
              type="button"
              onClick={handleBulkCopy}
              disabled={selectedMessageIds.size === 0}
              className="px-3 py-1.5 rounded-lg text-[#111B21] hover:bg-white/80 disabled:opacity-50 disabled:pointer-events-none text-[13px]"
            >
              نسخ
            </button>
            <button
              type="button"
              onClick={() => {}}
              className="px-3 py-1.5 rounded-lg text-[#111B21] hover:bg-white/80 text-[13px]"
            >
              إعادة توجيه
            </button>
            <button
              type="button"
              onClick={exitSelectionMode}
              className="px-3 py-1.5 rounded-lg text-[#111B21] hover:bg-white/80 text-[13px]"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* شريط البحث (يظهر عند الطلب) */}
      {searchOpen && (
        <div className="flex-shrink-0 px-4 py-2.5 bg-[#F0F2F5] border-b border-black/5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في المحادثة"
              className="flex-1 h-9 rounded-lg bg-white px-3 text-[14px] text-[#111B21] placeholder:text-[#667781] focus:outline-none focus:ring-1 focus:ring-[#00A884]/30 border border-black/5"
            />
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="text-[#54656F] hover:text-[#111B21] text-[13px]"
            >
              إغلاق
            </button>
          </div>
          {searchQuery.trim() && (
            <p className="text-slate-400 text-xs mt-1.5">
              {filteredMessages.length === 0
                ? "لا توجد نتائج"
                : `${filteredMessages.length} ${filteredMessages.length === 1 ? "نتيجة" : "نتائج"}`}
            </p>
          )}
        </div>
      )}

      {/* منطقة الرسائل */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={listRef}
        onScroll={handleMessagesScroll}
        className="chat-messages chat-bg-light flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 min-h-0"
        style={{
          paddingBottom: `${16 + (isMobileLayout ? keyboardInset : 0)}px`,
        }}
      >
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[280px] text-center px-4">
            {searchQuery ? (
              <>
                <p className="text-[#111B21] font-medium text-[15px]">لا توجد نتائج لـ «{searchQuery}»</p>
                <p className="text-[#667781] text-[13px] mt-1">جرّب كلمات أخرى</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-[#E9EDEF] flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#667781]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.864 9.864 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-[#111B21] font-medium text-[15px] mb-0.5">لا توجد رسائل بعد</p>
                <p className="text-[#667781] text-[13px]">اكتب رسالة لبدء المحادثة</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredMessages.map((m, index) => {
              const showDateSeparator =
                index === 0 || getDateKey(m.sentAt) !== getDateKey(filteredMessages[index - 1].sentAt);
              const isMe = m.senderId === currentUserId;
              const isFirstInGroup =
                index === 0 || filteredMessages[index - 1].senderId !== m.senderId;
              return (
                <div key={m.id} className="space-y-1">
                  {showDateSeparator && (
                    <div className="flex items-center justify-center py-3">
                      <span className="px-3 py-1.5 rounded-full bg-[#E9EDEF] text-[#667781] text-[12px] font-medium">
                        {getDateLabel(m.sentAt)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex ${isMe ? "justify-start" : "justify-end"} chat-bubble group/item ${
                      selectionMode && selectedMessageIds.has(m.id) ? "ring-2 ring-[#00A884] rounded-2xl" : ""
                    }`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (selectionMode) {
                        if (!m.isDeleted && !m.hiddenByMe) toggleMessageSelection(m.id);
                        return;
                      }
                      if (m.isDeleted || m.hiddenByMe) return;
                      // القائمة الكاملة (حذف، تحديد، نسخ، رد، تحويل) تظهر فقط من زر النقاط الثلاثة ⋮ وليس عند الضغط المطول
                    }}
                    onClick={() => {
                      if (selectionMode && !m.isDeleted && !m.hiddenByMe) {
                        toggleMessageSelection(m.id);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (selectionMode) return;
                      if (m.isDeleted || m.hiddenByMe) return;
                      const x = e.touches[0]?.clientX ?? 0;
                      swipeStartRef.current = { x, messageId: m.id };
                      longPressTimerRef.current = setTimeout(() => handleLongPress(m.id), 500);
                    }}
                    onTouchEnd={(e) => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      const start = swipeStartRef.current;
                      if (start && start.messageId === m.id && e.changedTouches[0]) {
                        const endX = e.changedTouches[0].clientX;
                        const deltaX = endX - start.x;
                        if (Math.abs(deltaX) >= SWIPE_REPLY_THRESHOLD) {
                          startReply(m.id);
                        }
                      }
                      swipeStartRef.current = null;
                    }}
                    onTouchMove={(e) => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                  >
                  <div
                    className={`min-w-0 flex items-end gap-1 ${isMe ? "bubble-sender" : "bubble-receiver"} ${
                      !isFirstInGroup ? (isMe ? "bubble-sender-continuation" : "bubble-receiver-continuation") : ""
                    }`}
                  >
                    {selectionMode && !m.isDeleted && !m.hiddenByMe && (
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedMessageIds.has(m.id)
                            ? "bg-[#00A884] border-[#00A884]"
                            : "border-[#667781]/40"
                        }`}
                      >
                        {selectedMessageIds.has(m.id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                    {(m.isDeleted || m.hiddenByMe) ? (
                      <p className={`text-[14px] italic text-[#667781]`}>تم حذف هذه الرسالة</p>
                    ) : (
                    <>
                    {m.replyTo && (
                      <div className={`mb-2 py-1.5 px-2.5 rounded-lg border-r-2 border-[#00A884]/40 ${isMe ? "bg-[#DCF8C6]/50" : "bg-[#E9EDEF]/80"}`}>
                        <p className={`text-[13px] truncate text-[#111B21]`}>{m.replyTo.isDeleted ? "تم حذف هذه الرسالة" : (m.replyTo.content || "رسالة")}</p>
                      </div>
                    )}
                    {m.messageType === "voice" ? (
                      <div className="flex items-center gap-2">
                        <audio
                          controls
                          className="max-w-full h-9 min-w-[180px]"
                          src={`data:audio/webm;base64,${m.content}`}
                        />
                      </div>
                    ) : m.messageType === "image" ? (
                      <div className="space-y-2">
                        <div className="rounded-lg overflow-hidden bg-black/20 max-w-[260px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.content.startsWith("data:") ? m.content : `data:image/jpeg;base64,${m.content}`}
                            alt="صورة"
                            className="block w-full h-auto max-h-[280px] object-contain cursor-pointer"
                            onClick={() => setZoomedImageSrc(m.content.startsWith("data:") ? m.content : `data:image/jpeg;base64,${m.content}`)}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={m.content.startsWith("data:") ? m.content : `data:image/jpeg;base64,${m.content}`}
                            download={`صورة-${m.id.slice(0, 8)}.jpg`}
                            className={`text-[12px] hover:underline text-[#111B21] opacity-90`}
                          >
                            تحميل
                          </a>
                          <button
                            type="button"
                            onClick={() => setZoomedImageSrc(m.content.startsWith("data:") ? m.content : `data:image/jpeg;base64,${m.content}`)}
                            className={`text-[12px] hover:underline text-[#111B21] opacity-90`}
                          >
                            تكبير
                          </button>
                        </div>
                      </div>
                    ) : m.messageType === "sticker" ? (
                      <div className="rounded-lg overflow-hidden max-w-[120px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.content}
                          alt="ملصق"
                          className="block w-full h-auto cursor-pointer"
                          onClick={() => setZoomedImageSrc(m.content)}
                        />
                      </div>
                    ) : m.messageType === "gif" ? (
                      <div className="rounded-lg overflow-hidden bg-black/20 max-w-[260px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            m.content.startsWith("http")
                              ? m.content
                              : m.content.startsWith("data:")
                                ? m.content
                                : `data:image/gif;base64,${m.content}`
                          }
                          alt="GIF"
                          className="block w-full h-auto max-h-[280px] object-contain cursor-pointer"
                          onClick={() =>
                            setZoomedImageSrc(
                              m.content.startsWith("http") || m.content.startsWith("data:")
                                ? m.content
                                : `data:image/gif;base64,${m.content}`
                            )
                          }
                        />
                      </div>
                    ) : m.messageType === "text" && !m.replyTo ? (
                      /* رسالة نصية فقط بدون رد: الوقت والعلامات على نفس السطر أو مع آخر سطر */
                      <div className="leading-[1.45] break-words">
                        <span className="text-[14.5px] whitespace-pre-wrap align-middle">{m.content}</span>
                        {" "}
                        <span className={`inline-flex items-center gap-0.5 align-middle text-[11px] text-[#667781]`}>
                          {new Date(m.sentAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          {isMe && (
                            <span
                              className={`font-medium ${m.isRead ? "text-[#00A884]" : "text-[#667781]"}`}
                              title={
                                m.isRead ? "تمت القراءة" : new Date(m.sentAt).getTime() > Date.now() - 3000 ? "تم الإرسال" : "تم الاستلام"
                              }
                            >
                              {m.isRead ? "✓✓" : new Date(m.sentAt).getTime() > Date.now() - 3000 ? "✓" : "✓✓"}
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      /* نص مع رد: المحتوى فقط، الوقت يظهر في السطر التحتي */
                      <p className="text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap">{m.content}</p>
                    )}
                    </>
                    )}
                    {/* للرسائل غير النصية (صورة، صوت، رد، إلخ): الوقت والعلامات في سطر تحت المحتوى بمحاذاة النهاية */}
                    {((m.isDeleted || m.hiddenByMe) || m.replyTo || m.messageType !== "text") && (
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 ${isMe ? "text-[#667781]" : "text-[#667781]"}`}
                    >
                      <span className="text-[11px]">
                        {new Date(m.sentAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isMe && !m.isDeleted && !m.hiddenByMe && (
                        <span
                          className={`text-[12px] leading-none font-medium ${m.isRead ? "text-[#00A884]" : "text-[#667781]"}`}
                          title={
                            m.isRead ? "تمت القراءة" : new Date(m.sentAt).getTime() > Date.now() - 3000 ? "تم الإرسال" : "تم الاستلام"
                          }
                        >
                          {m.isRead ? "✓✓" : new Date(m.sentAt).getTime() > Date.now() - 3000 ? "✓" : "✓✓"}
                        </span>
                      )}
                    </div>
                    )}
                    {!m.isDeleted && !m.hiddenByMe && (m.reactions?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                        {m.reactions!.map((r) => (
                          <span
                            key={r.emoji}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-sm ${
                              r.userIds.includes(currentUserId) ? "bg-[#DCF8C6]/80" : "bg-[#E9EDEF]"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            {r.count > 1 && <span className="text-[10px] opacity-80">{r.count}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    </div>
                    {!selectionMode && !m.isDeleted && !m.hiddenByMe && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openMessageMenu(m.id); }}
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#54656F] hover:text-[#111B21] hover:bg-[#E9EDEF] opacity-80 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity touch-manipulation"
                        aria-label="خيارات الرسالة"
                      >
                        <span className="text-lg leading-none">⋮</span>
                      </button>
                    )}
                  </div>
                </div>
                </div>
              );
            })}
            {otherUserTyping && (
              <div className="flex justify-start pt-1">
                <div className="inline-flex items-center gap-1.5 rounded-[12px] rounded-tl-[4px] bg-white px-4 py-2 shadow-[var(--shadow-bubble)]">
                  <span className="flex gap-0.5">
                    <span className="w-2 h-2 rounded-full bg-[#667781] animate-bounce opacity-70" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-[#667781] animate-bounce opacity-70" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-[#667781] animate-bounce opacity-70" style={{ animationDelay: "300ms" }} />
                  </span>
                  <span className="text-[#667781] text-[13px]">{otherUserName} يكتب الآن...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* زر رسائل جديدة */}
        {hasNewMessages && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-[#111B21] text-[13px] font-medium shadow-md hover:bg-[#F5F6F6] active:scale-95 transition border border-black/5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              رسائل جديدة
            </button>
          </div>
        )}
      </div>

      {/* لوحة الإيموجي بدل الكيبورد (موبايل فقط) — تأخذ ارتفاعها الطبيعي حتى لا تظهر فراغات */}
      {!selectionMode && isMobileLayout && emojiOpen && (
        <div
          ref={emojiPanelRef}
          className="flex-shrink-0 w-full bg-[#F0F2F5] border-t border-black/5 safe-area-inset max-h-[45vh] overflow-hidden"
        >
          <MediaPickerPopover
            onEmojiSelect={insertEmoji}
            onStickerSelect={async (url) => {
              setEmojiOpen(false);
              await sendSticker(url);
            }}
            onGifSelect={async (dataUrl) => {
              setEmojiOpen(false);
              await sendGif(dataUrl);
            }}
            onClose={() => setEmojiOpen(false)}
            onSwitchToKeyboard={switchToKeyboard}
            keyboardHeightMode
            className="w-full h-full rounded-none border-0 shadow-none"
          />
        </div>
      )}

      {/* شريط الإدخال السفلي — ثابت وأنيق */}
      {!selectionMode && (
      <div ref={inputAreaRef} className="flex-shrink-0 px-3 py-3 pb-4 pt-2 bg-[#F0F2F5] safe-area-inset border-t border-black/5">
        {/* شريط التسجيل الصوتي */}
        {isRecording && (
          <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2.5 rounded-2xl bg-white shadow-sm border border-black/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 animate-pulse">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </span>
              <span className="text-[#111B21] text-[14px]">تسجيل...</span>
              <span className="text-[#667781] text-[13px] font-mono tabular-nums">
                {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={sendVoiceMessage}
                disabled={isSendingVoice || recordingSeconds < 1}
                className="px-3 py-1.5 rounded-lg bg-[#00A884] text-white text-[13px] font-medium hover:bg-[#06CF9C] disabled:opacity-50 disabled:pointer-events-none"
              >
                إرسال
              </button>
              <button
                type="button"
                onClick={cancelVoiceMessage}
                disabled={isSendingVoice}
                className="px-3 py-1.5 rounded-lg bg-[#E9EDEF] text-[#111B21] text-[13px] font-medium hover:bg-[#D1D7DB] disabled:opacity-50 disabled:pointer-events-none"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {replyToMessageId && (() => {
          const rep = messages.find((m) => m.id === replyToMessageId);
          if (!rep || rep.isDeleted || rep.hiddenByMe) return null;
          const replyPreview = rep.messageType === "text"
            ? (rep.content?.slice(0, 80) ?? "")
            : rep.messageType === "image"
              ? "📷 صورة"
              : rep.messageType === "voice"
                ? "🎤 رسالة صوتية"
                : rep.messageType === "sticker"
                  ? "ملصق"
                  : rep.messageType === "gif"
                    ? "GIF"
                    : "";
          return (
            <div className="mb-2 px-3 py-2 rounded-xl bg-white border-r-4 border-[#00A884] flex items-center justify-between gap-2 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="text-[#111B21] text-[13px] truncate">{replyPreview || "رسالة"}</p>
              </div>
              <button type="button" onClick={cancelReply} className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-[#E9EDEF] flex items-center justify-center text-[#54656F]" aria-label="إلغاء الرد">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })()}

        {!isRecording && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* حقل الكتابة — pill shape */}
          <div className="flex-1 min-w-0 flex items-end gap-1 rounded-[22px] bg-white py-1.5 pl-2 pr-2 focus-within:ring-1 focus-within:ring-[#00A884]/30 transition-shadow shadow-sm border border-black/5">
            <button
              ref={emojiBtnRef}
              type="button"
              onClick={() => {
                setAttachOpen(false);
                if (isMobileLayout) {
                  inputRef.current?.blur();
                  setEmojiOpen((v) => !v);
                } else {
                  setEmojiOpen((v) => !v);
                }
              }}
              className="flex-shrink-0 w-9 h-9 rounded-full text-[#54656F] hover:bg-[#E9EDEF] transition-colors text-xl flex items-center justify-center"
              aria-label="ايموجي"
              title="ايموجي"
            >
              😊
            </button>
            {emojiOpen && !isMobileLayout &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={emojiPanelRef}
                  className="fixed z-[9999] inset-x-0 left-0 right-0 w-full px-2 sm:px-4"
                  style={{
                    bottom: inputAreaTop > 0 ? `calc(100vh - ${inputAreaTop}px + 8px)` : "80px",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <div className="w-full max-w-full">
                    <MediaPickerPopover
                      onEmojiSelect={insertEmoji}
                    onStickerSelect={async (url) => {
                      setEmojiOpen(false);
                      await sendSticker(url);
                    }}
                    onGifSelect={async (dataUrl) => {
                      setEmojiOpen(false);
                      await sendGif(dataUrl);
                    }}
                    onClose={() => setEmojiOpen(false)}
                    className="w-full"
                  />
                  </div>
                </div>,
                document.body
              )}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => scrollToBottom("auto")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault();
                  (e.target as HTMLFormElement).form?.requestSubmit();
                }
              }}
              name="content"
              placeholder="مراسلة"
              maxLength={2000}
              rows={1}
              className="flex-1 min-w-0 min-h-[42px] max-h-32 py-2.5 pl-2 pr-2 bg-transparent text-[#111B21] placeholder:text-[#667781] text-[15px] focus:outline-none rounded-xl resize-none overflow-y-auto leading-[1.4]"
            />
          </div>

          {/* زر المرفقات + */}
          <div className="relative flex-shrink-0">
            <button
              ref={attachBtnRef}
              type="button"
              onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}
              className="flex items-center justify-center w-10 h-10 rounded-full text-[#54656F] hover:bg-[#E9EDEF] transition-colors text-2xl font-light leading-none"
              aria-label="مرفقات وكاميرا وتسجيل"
              title="ملف، كاميرا، تسجيل"
            >
              +
            </button>
            {attachOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={attachPanelRef}
                  className="fixed z-[9999] w-52 rounded-xl bg-white shadow-lg border border-black/5 py-1.5"
                  style={{ bottom: popoverPosition.bottom, left: popoverPosition.left }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => { setAttachOpen(false); imageInputRef.current?.click(); }}
                    className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">🖼</span>
                    صورة من الجهاز
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAttachOpen(false); fileInputRef.current?.click(); }}
                    className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">📎</span>
                    إرسال ملف
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAttachOpen(false); setCameraChoiceOpen(true); }}
                    className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">📷</span>
                    كاميرا
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAttachOpen(false); startRecording(); }}
                    className="w-full px-4 py-2.5 text-right text-[14px] text-[#111B21] hover:bg-[#F5F6F6] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">🎤</span>
                    تسجيل صوتي
                  </button>
                </div>,
                document.body
              )}
          </div>

          {/* 4. زر الإرسال ➤ (يظهر فقط عند وجود نص) */}
          <div className="flex-shrink-0 flex items-end pb-0.5">
            {inputValue.trim() ? (
              <button
                type="submit"
                disabled={isSending}
                onPointerDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                className="w-11 h-11 rounded-full bg-[#00A884] text-white flex items-center justify-center hover:bg-[#06CF9C] active:scale-95 shadow-md transition-all disabled:opacity-60 disabled:pointer-events-none"
                aria-label="إرسال"
                title="إرسال"
              >
                <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            ) : null}
          </div>
        </form>
        )}
        {sendError && (
          <p className="text-red-600 text-[12px] mt-2 px-1">{sendError}</p>
        )}
      </div>
      )}

      {/* شريط التفاعل السريع (عند الضغط المطول) */}
      {reactionBarMessageId && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end items-center pb-24"
          onClick={() => setReactionBarMessageId(null)}
        >
          <div
            className="flex items-center gap-0.5 px-2 py-2 rounded-2xl bg-white shadow-lg border border-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddReaction(reactionBarMessageId, emoji)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#F0F2F5] text-2xl transition-transform active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* نافذة تأكيد مسح المحادثة */}
      {clearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex flex-col items-center justify-center p-4"
          onClick={() => setClearConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 border border-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#111B21] mb-2">مسح المحادثة</h3>
            <p className="text-[#667781] text-[14px] mb-5">اختر طريقة الحذف:</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleClearConversation(true)}
                className="w-full py-3 rounded-xl bg-[#F0F2F5] hover:bg-[#E9EDEF] text-[#111B21] text-[14px] font-medium"
              >
                حذف من عندي فقط
              </button>
              <button
                type="button"
                onClick={() => handleClearConversation(false)}
                className="w-full py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[14px] font-medium"
              >
                حذف للجميع (لا يمكن التراجع)
              </button>
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="w-full py-2.5 text-[#667781] text-[14px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* قائمة خيارات الرسالة (ضغط مطول أو زر ⋮) */}
      {messageMenuMessageId && (() => {
        const sel = messages.find((msg) => msg.id === messageMenuMessageId);
        const isText = sel?.messageType === "text" && !sel?.isDeleted && !sel?.hiddenByMe;
        const isSender = sel?.senderId === currentUserId;
        const showDeleteForEveryone = isSender; // فقط المرسل يمكنه حذف للجميع (ضمن المدة)
        return (
          <div
            className="fixed inset-0 z-40 bg-black/50 flex flex-col justify-end"
            onClick={closeMessageMenu}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Escape" && closeMessageMenu()}
            aria-label="إغلاق القائمة"
          >
            <div
              className="bg-white rounded-t-2xl shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto border-t border-black/5"
              onClick={(e) => e.stopPropagation()}
            >
              {deleteSubMenuMessageId === messageMenuMessageId ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteSubMenuMessageId(null)}
                    className="w-full px-4 py-3 text-right text-[#667781] text-[14px] flex items-center gap-2"
                  >
                    <span>←</span> رجوع
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(messageMenuMessageId, "for_me")}
                    className="w-full px-4 py-3 text-right text-[#111B21] hover:bg-[#F5F6F6] text-[14px]"
                  >
                    حذف من عندي فقط
                  </button>
                  {showDeleteForEveryone && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(messageMenuMessageId, "for_everyone")}
                        className="w-full px-4 py-3 text-right text-red-600 hover:bg-red-50 text-[14px]"
                      >
                        حذف من المحادثة بالكامل
                      </button>
                      <p className="px-4 py-1 text-[#667781] text-[12px] text-right">خلال 15 دقيقة من الإرسال فقط</p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteSubMenuMessageId(messageMenuMessageId)}
                    className="w-full px-4 py-3 text-right text-[#111B21] hover:bg-[#F5F6F6] text-[14px] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">🗑️</span>
                    حذف هذه الرسالة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeMessageMenu();
                      setSelectionMode(true);
                      setSelectedMessageIds((prev) => new Set([...prev, messageMenuMessageId]));
                    }}
                    className="w-full px-4 py-3 text-right text-[#111B21] hover:bg-[#F5F6F6] text-[14px] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">☑</span>
                    تحديد الرسالة
                  </button>
                  {isText && (
                    <button
                      type="button"
                      onClick={() => copyMessageText(messageMenuMessageId)}
                      className="w-full px-4 py-3 text-right text-[#111B21] hover:bg-[#F5F6F6] text-[14px] flex items-center gap-3"
                    >
                      <span className="text-[#54656F]">📋</span>
                      نسخ النص
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      closeMessageMenu();
                      startReply(messageMenuMessageId);
                    }}
                    className="w-full px-4 py-3 text-right text-[#111B21] hover:bg-[#F5F6F6] text-[14px] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">↩</span>
                    الرد على الرسالة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleForwardMessage(messageMenuMessageId)}
                    className="w-full px-4 py-3 text-right text-[#111B21] hover:bg-[#F5F6F6] text-[14px] flex items-center gap-3"
                  >
                    <span className="text-[#54656F]">↗</span>
                    إعادة توجيه
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* إشعار اتصال وارد للطرف الثاني */}
      {incomingCall && !callOpen && (
        <div className="fixed inset-0 z-[55] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/5 shadow-2xl p-4">
            <p className="text-[#667781] text-[13px] mb-1">اتصال وارد</p>
            <h3 className="text-[#111B21] text-[16px] font-semibold mb-1">{otherUserName}</h3>
            <p className="text-[#667781] text-[13px] mb-4">
              {incomingCall.mode === "audio" ? "يريد بدء اتصال صوتي" : "يريد بدء اتصال فيديو"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={declineIncomingCall}
                className="flex-1 h-11 rounded-xl bg-[#E9EDEF] text-[#111B21] text-[14px] font-medium hover:bg-[#DDE2E5]"
              >
                رفض
              </button>
              <button
                type="button"
                onClick={acceptIncomingCall}
                className="flex-1 h-11 rounded-xl bg-[#00A884] text-white text-[14px] font-medium hover:bg-[#06CF9C]"
              >
                قبول
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الاتصال المباشر داخل التطبيق */}
      {callOpen && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
          <div className="flex-shrink-0 h-14 px-3 border-b border-white/10 bg-black/70 flex items-center justify-between">
            <div className="text-white text-[14px]">
              {callMode === "audio" ? "اتصال صوتي" : "اتصال فيديو"} مع {otherUserName}
            </div>
            <button
              type="button"
              onClick={closeCall}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="إغلاق الاتصال"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <div ref={callContainerRef} className="w-full h-full" />
            {callError && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
                <div className="max-w-sm w-full rounded-xl bg-slate-900 border border-white/10 p-4 text-center">
                  <p className="text-red-300 text-sm">{callError}</p>
                  <button
                    type="button"
                    onClick={closeCall}
                    className="mt-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* اختيار الكاميرا: أمامية أو خلفية */}
      {cameraChoiceOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
          onClick={() => setCameraChoiceOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-slate-800 border border-white/10 p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-300 text-sm text-center mb-4">اختر الكاميرا</p>
            <button
              type="button"
              onClick={() => openCamera("environment")}
              className="w-full py-3 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm"
            >
              كاميرا خلفية
            </button>
            <button
              type="button"
              onClick={() => openCamera("user")}
              className="w-full py-3 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm"
            >
              كاميرا أمامية
            </button>
            <button
              type="button"
              onClick={() => setCameraChoiceOpen(false)}
              className="w-full py-2 text-slate-400 text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* واجهة الكاميرا (getUserMedia) */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 relative flex items-center justify-center min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-cover w-full h-full"
              style={{ transform: cameraFacingMode === "user" ? "scaleX(-1)" : "none" }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center">
                <p className="text-red-400 mb-4">{cameraError}</p>
                <button
                  type="button"
                  onClick={useCameraFallback}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm"
                >
                  استخدام اختيار الملف
                </button>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="mt-2 text-slate-400 text-sm"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
          {!cameraError && (
            <div className="flex-shrink-0 flex items-center justify-center gap-4 p-4 bg-slate-900/95">
              <button
                type="button"
                onClick={switchCameraFacing}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white"
                aria-label="تبديل الكاميرا"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 flex items-center justify-center"
                aria-label="التقاط"
              />
              <button
                type="button"
                onClick={closeCamera}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white"
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* fallback: input capture عندما يفشل getUserMedia */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            setImagePreview({ dataUrl: reader.result as string, file });
            setImagePreviewCaption("");
          };
        }}
      />

      {/* نافذة تكبير الصورة */}
      {zoomedImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedImageSrc(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Escape" && setZoomedImageSrc(null)}
          aria-label="إغلاق"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImageSrc}
            alt="تكبير الصورة"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoomedImageSrc(null)}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="إغلاق"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const valid = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type);
          if (!valid) return;
          setAttachOpen(false);
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            setImagePreview({ dataUrl: reader.result as string, file });
            setImagePreviewCaption("");
          };
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          e.target.value = "";
          setAttachOpen(false);
          // TODO: ملف - لاحقًا
        }}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* معاينة الصورة قبل الإرسال */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 border border-white/10 overflow-hidden shadow-2xl">
            <div className="relative aspect-square max-h-[50vh] bg-black/30 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview.dataUrl}
                alt="معاينة"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="p-4 space-y-4">
              <input
                type="text"
                value={imagePreviewCaption}
                onChange={(e) => setImagePreviewCaption(e.target.value)}
                placeholder="كتابة تعليق اختياري..."
                className="w-full h-11 rounded-xl bg-slate-700/80 border border-white/10 px-4 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                maxLength={500}
              />
              {imageUploadError && (
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <span>⚠</span>
                  {imageUploadError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImagePreviewCaption(""); setImageUploadError(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-500 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!imagePreview) return;
                    setImageUploadError(null);
                    setIsSending(true);
                    const dataUrl = imagePreview.dataUrl;
                    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
                    try {
                      const res = await fetch("/api/chat/messages", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ conversationId, content: base64, messageType: "image" }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setMessages((prev) => [...prev, { ...data, messageType: "image" }]);
                        if (imagePreviewCaption.trim()) {
                          const res2 = await fetch("/api/chat/messages", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ conversationId, content: imagePreviewCaption.trim() }),
                          });
                          const data2 = await res2.json();
                          if (res2.ok) setMessages((prev) => [...prev, data2]);
                        }
                        setImagePreview(null);
                        setImagePreviewCaption("");
                      } else {
                        setImageUploadError(data.error ?? "فشل إرسال الصورة");
                      }
                    } catch {
                      setImageUploadError("حدث خطأ في الإرسال. جرّب مرة أخرى.");
                    }
                    setIsSending(false);
                  }}
                  disabled={isSending}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                >
                  {isSending ? "جاري الرفع..." : imageUploadError ? "إعادة المحاولة" : "إرسال"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
