/* eslint-disable no-unused-vars */
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { AnyCommands, Dispatch, Mark, mergeAttributes, Range } from "@tiptap/core";
import { Mark as PMMark } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment (add)
       */
      setComment: (commentId: string) => ReturnType;
      /**
       * Unset a comment (remove)
       */
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export interface MarkWithRange {
  mark: PMMark;
  range: Range;
}

export interface CommentOptions {
  HTMLAttributes: Record<string, any>;
  onCommentActivated: (commentId: string) => void;
}

export interface CommentStorage {
  activeCommentId: string | null;
}

export const Comment = Mark.create<CommentOptions, CommentStorage>({
  name: "comment",

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentActivated: () => {

      },
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-comment-id"),
        renderHTML: (attrs) => ({ "data-comment-id": attrs.commentId, name: `comment-${attrs.commentId}` }),
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (el) =>
          !!(el as HTMLSpanElement).getAttribute("data-comment-id")?.trim() &&
          null,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  onSelectionUpdate() {
    const { $from } = this.editor.state.selection;

    const marks = $from.marks();

    if (!marks.length) {
      this.storage.activeCommentId = null;
      this.options.onCommentActivated(this.storage.activeCommentId || '');
      window?.localStorage.setItem('activeCommentId', 'null')
      return;
    }

    const commentMark = this.editor.schema.marks.comment;
    const activeCommentMark = marks.find((mark) => mark.type === commentMark);

    this.storage.activeCommentId = activeCommentMark?.attrs.commentId || null;
    
    this.options.onCommentActivated(this.storage.activeCommentId || '');

    // Check if 'activeCommentId' exists in 'this.storage' and set it in localStorage
    window?.localStorage.setItem('activeCommentId', this.storage.activeCommentId || '');

  },

  addStorage() {
    return {
      activeCommentId: null,
    };
  },

  // @ts-ignore
  addCommands() {
    return {
      setComment:
        (commentId: string) =>
          ({ commands }: { commands: AnyCommands }) => {


            if (!commentId) return false;
            const commentText = document.querySelector(`#${commentId}`) || '';

            commands.setMark("comment", { commentId, commentText });

            window?.localStorage.setItem('activeCommentId', `${commentId}`);

          },
      unsetComment:
        (commentId: string) =>
          ({ tr, dispatch }: { tr: any, dispatch: Dispatch }) => {

            if (!commentId) {
              return false;
            }

            const commentMarksWithRange: MarkWithRange[] = [];

            tr.doc.descendants((node: any, pos: any) => {
              const commentMark = node.marks.find(
                (mark: any) =>
                  mark.type.name === "comment" &&
                  mark.attrs.commentId === commentId
              );

              if (!commentMark) return;

              commentMarksWithRange.push({
                mark: commentMark,
                range: {
                  from: pos,
                  to: pos + node.nodeSize,
                },
              });
            });

            commentMarksWithRange.forEach(({ mark, range }) => {
              tr.removeMark(range.from, range.to, mark);
            });

            return dispatch?.(tr);
          },
    };
  },
});