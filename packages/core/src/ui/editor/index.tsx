"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, JSONContent } from "@tiptap/react";
import { defaultEditorProps } from "./props";
import { defaultExtensions } from "./extensions";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { useDebouncedCallback } from "use-debounce";
import { useCompletion } from "ai/react";
import { toast } from "sonner";
import va from "@vercel/analytics";
import { defaultEditorContent } from "./default-content";
import { EditorBubbleMenu } from "./bubble-menu";
import { getPrevText } from "@/lib/editor";
import { ImageResizer } from "./extensions/image-resizer";
import { EditorProps } from "@tiptap/pm/view";
import { Editor as EditorClass, Extensions } from "@tiptap/core";
import { NovelContext } from "./provider";
import { Comment } from './plugins/Comment';
import { v4 } from "uuid";

interface IComment {
  id: string
  content: string
  replies: Comment[]
  createdAt: Date
}


const getNewComment = (content: string): IComment => {
  return {
    id: `a${v4()}a`,
    content,
    replies: [],
    createdAt: new Date()
  }
}

export default function Editor({
  completionApi = "/api/generate",
  className = "novel-relative novel-min-h-[500px] novel-w-full novel-max-w-screen-lg novel-border-stone-200 novel-bg-white sm:novel-mb-[calc(20vh)] sm:novel-rounded-lg sm:novel-border sm:novel-shadow-lg",
  defaultValue = defaultEditorContent,
  extensions = [],
  editorProps = {},
  onUpdate = () => {},
  onDebouncedUpdate = () => {},
  debounceDuration = 750,
  storageKey = "novel__content",
  disableLocalStorage = false,
}: {
  /**
   * The API route to use for the OpenAI completion API.
   * Defaults to "/api/generate".
   */
  completionApi?: string;
  /**
   * Additional classes to add to the editor container.
   * Defaults to "relative min-h-[500px] w-full max-w-screen-lg border-stone-200 bg-white sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg".
   */
  className?: string;
  /**
   * The default value to use for the editor.
   * Defaults to defaultEditorContent.
   */
  defaultValue?: JSONContent | string;
  /**
   * A list of extensions to use for the editor, in addition to the default Novel extensions.
   * Defaults to [].
   */
  extensions?: Extensions;
  /**
   * Props to pass to the underlying Tiptap editor, in addition to the default Novel editor props.
   * Defaults to {}.
   */
  editorProps?: EditorProps;
  /**
   * A callback function that is called whenever the editor is updated.
   * Defaults to () => {}.
   */
  // eslint-disable-next-line no-unused-vars
  onUpdate?: (editor?: EditorClass) => void | Promise<void>;
  /**
   * A callback function that is called whenever the editor is updated, but only after the defined debounce duration.
   * Defaults to () => {}.
   */
  // eslint-disable-next-line no-unused-vars
  onDebouncedUpdate?: (editor?: EditorClass) => void | Promise<void>;
  /**
   * The duration (in milliseconds) to debounce the onDebouncedUpdate callback.
   * Defaults to 750.
   */
  debounceDuration?: number;
  /**
   * The key to use for storing the editor's value in local storage.
   * Defaults to "novel__content".
   */
  storageKey?: string;
  /**
   * Disable local storage read/save.
   * Defaults to false.
   */
  disableLocalStorage?: boolean;
}) {
  const [content, setContent] = useLocalStorage(storageKey, defaultValue);

  const [hydrated, setHydrated] = useState(false);

  const [comments, setComments] = useState<IComment[]>([])

  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)

  const commentsSectionRef = useRef<HTMLDivElement | null>(null)

  const focusCommentWithActiveId = (id: string) => {
    if (!commentsSectionRef.current) return

    const commentInput = commentsSectionRef.current.querySelector<HTMLInputElement>(`input#${id}`)

    if (!commentInput) return

    commentInput.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
  }

  useEffect(
    () => {
      if (!activeCommentId) return

      focusCommentWithActiveId(activeCommentId)
    }
    , [activeCommentId]
  )



  const debouncedUpdates = useDebouncedCallback(async ({ editor }) => {
    const json = editor.getJSON();
    onDebouncedUpdate(editor);

    if (!disableLocalStorage) {
      setContent(json);
    }
  }, debounceDuration);

  const editor = useEditor({
    extensions: [
      ...defaultExtensions, 
      ...extensions,
      Comment.configure({
        HTMLAttributes: {
          class: "my-comment",
        },
        onCommentActivated: (commentId) => {
          setActiveCommentId(commentId);
    
          if (commentId) setTimeout(() => focusCommentWithActiveId(commentId));
        },
      }),
    ],
    editorProps: {
      ...defaultEditorProps,
      ...editorProps,
    },
    onUpdate: (e) => {
      const selection = e.editor.state.selection;
      const lastTwo = getPrevText(e.editor, {
        chars: 2,
      });
      if (lastTwo === "++" && !isLoading) {
        e.editor.commands.deleteRange({
          from: selection.from - 2,
          to: selection.from,
        });
        complete(
          getPrevText(e.editor, {
            chars: 5000,
          })
        );
        va.track("Autocomplete Shortcut Used");
      } else {
        onUpdate(e.editor);
        debouncedUpdates(e);
      }
    },
    autofocus: "end",
  });

  const setComment = () => {
    const newComment = getNewComment('')

    setComments([...comments, newComment])

    // @ts-ignore
    editor?.commands?.setComment?.(newComment.id)

    setActiveCommentId(newComment.id)

    setTimeout(focusCommentWithActiveId)
  }

  const { complete, completion, isLoading, stop } = useCompletion({
    id: "novel",
    api: completionApi,
    onFinish: (_prompt, completion) => {
      editor?.commands.setTextSelection({
        from: editor.state.selection.from - completion.length,
        to: editor.state.selection.from,
      });
    },
    onError: (err) => {
      toast.error(err.message);
      if (err.message === "You have reached your request limit for the day.") {
        va.track("Rate Limit Reached");
      }
    },
  });

  const prev = useRef("");

  // Insert chunks of the generated text
  useEffect(() => {
    const diff = completion.slice(prev.current.length);
    prev.current = completion;
    editor?.commands.insertContent(diff);
  }, [isLoading, editor, completion]);

  useEffect(() => {
    // if user presses escape or cmd + z and it's loading,
    // stop the request, delete the completion, and insert back the "++"
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.metaKey && e.key === "z")) {
        stop();
        if (e.key === "Escape") {
          editor?.commands.deleteRange({
            from: editor.state.selection.from - completion.length,
            to: editor.state.selection.from,
          });
        }
        editor?.commands.insertContent("++");
      }
    };
    const mousedownHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
      if (window.confirm("AI writing paused. Continue?")) {
        complete(editor?.getText() || "");
      }
    };
    if (isLoading) {
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("mousedown", mousedownHandler);
    } else {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", mousedownHandler);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", mousedownHandler);
    };
  }, [stop, isLoading, editor, complete, completion.length]);

  // Default: Hydrate the editor with the content from localStorage.
  // If disableLocalStorage is true, hydrate the editor with the defaultValue.
  useEffect(() => {
    if (!editor || hydrated) return;

    const value = disableLocalStorage ? defaultValue : content;

    if (value) {
      editor.commands.setContent(value);
      setHydrated(true);
    }
  }, [editor, defaultValue, content, hydrated, disableLocalStorage]);

  return (
    <NovelContext.Provider
      value={{
        completionApi,
      }}
    >
      <div
        // onClick={() => {
        //   editor?.chain().focus().run();
        // }}
        className={className}
      >
        {editor && <EditorBubbleMenu setComment={setComment} editor={editor} />}
        {editor?.isActive("image") && <ImageResizer editor={editor} />}
        <EditorContent editor={editor} />

        <section className='flex flex-col gap-2 p-2 border rounded-lg w-96 border-slate-200' ref={commentsSectionRef}>
              {
                comments.length ? (
                  comments.map(comment => (
                    <div
                      key={comment.id}
                      className={`flex flex-col gap-4 p-2 border rounded-lg border-slate-400 ${comment.id === activeCommentId ? 'border-blue-400 border-2' : ''} box-border`}
                    >
                      <span className='flex items-end gap-2'>
                        <a href='#' className='font-semibold border-b border-blue-200'>
                          commentor
                        </a>

                        <span className='text-xs text-slate-400'>
                          {comment.createdAt.toLocaleDateString()}
                        </span>
                      </span>

                      <input
                        value={comment.content || ''}
                        disabled={comment.id !== activeCommentId}
                        className={`p-2 rounded-lg text-inherit bg-transparent focus:outline-none ${comment.id === activeCommentId ? 'bg-slate-600' : ''}`}
                        id={comment.id}
                        onInput={
                          (event) => {
                            const value = (event.target as HTMLInputElement).value

                            setComments(comments.map(comment => {
                              if (comment.id === activeCommentId) {
                                return {
                                  ...comment,
                                  content: value
                                }
                              }

                              return comment
                            }))
                          }
                        }
                        onKeyDown={
                          (event) => {
                            if (event.key !== 'Enter') return

                            setActiveCommentId(null)
                          }
                        }
                      />

                      {
                        comment.id === activeCommentId && (
                          <button
                            className='rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-white/20'
                            onClick={() => {
                              setActiveCommentId(null)
                              editor?.commands.focus()
                            }}
                          >
                            Save
                          </button>
                        )
                      }
                    </div>
                  ))
                ) : (
                  <span className='pt-8 text-center text-slate-400'>
                    No comments yet
                  </span>
                )
              }
            </section>
      </div>
    </NovelContext.Provider>
  );
}
