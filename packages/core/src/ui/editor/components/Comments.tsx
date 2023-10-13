/* eslint-disable no-unused-vars */
import React from 'react'
import { IComment } from '../index'
import { Editor } from '@tiptap/core';
import Resolve from '@/ui/icons/resolve';
import Trash from '@/ui/icons/trash';

interface ICommentProps {
  editor: Editor | null;
  comment: IComment;
  comments: IComment[];
  activeCommentId: IComment['id'] | null;
  setComments: (comments: IComment[]) => void;
  setActiveCommentId: (commentId: IComment['id'] | null) => void;
}

export const Comments = (props: Omit<ICommentProps, 'comment'>) => {
  const { comments } = props;
  return (
    <>
    {
      comments.length ? (
        comments.map(comment => (
        <Comment key={comment.id}  comment={comment} {...props} />
        ))
      ) : (
        <span className='pt-8 text-center text-slate-400'>
          No comments yet
        </span>
      )
    }
    </>
  )
}

const Comment = ({ editor, setActiveCommentId, comments, comment, activeCommentId, setComments }: ICommentProps) => {

  return (
    <div
    onClick={() => setActiveCommentId(comment.id)}
    className={`flex flex-col gap-4 p-2 border rounded-lg border-slate-400 ${comment.id === activeCommentId ? 'novel-border-yellow-600 border-2' : ''} box-border`}
  >
    <span className='flex items-end items-center'>
      <a href='#' className='font-semibold border-b border-blue-200'>
        Cujba Mihai
      </a>

      <span className='text-xs text-slate-400 novel-ml-2'>
        {new Date(comment.createdAt).toLocaleDateString()}
      </span>

      <button 
      className="novel-ml-auto"
      onClick={() => {
        editor?.commands.unsetComment(comment.id)
        setComments(comments.filter((commentItem) => {
          return commentItem.id !== comment.id;
        }))
      }}
      >
        <Resolve />
      </button>

      <button 
      className="novel-ml-2"
      onClick={() => {
        editor?.commands.unsetComment(comment.id)
        setComments(comments.filter((commentItem) => {
          return commentItem.id !== comment.id;
        }))
      }}
      >
        <Trash />
      </button>
    </span>

    <input
      value={comment.content || ''}
      disabled={comment.id !== activeCommentId}
      className={`p-2 rounded-lg text-inherit bg-transparent focus:outline-none ${comment.id === activeCommentId ? 'bg-stone-100' : ''}`}
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
  )
}