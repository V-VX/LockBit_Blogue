import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { decrypt, DecryptionError } from '../utils/crypto';
import { animateElement } from '../utils/animation';

type Props = {
  readonly ciphertext: string;
};

type DecryptState =
  | { readonly _tag: 'Ciphertext' }
  | { readonly _tag: 'Decrypting' }
  | { readonly _tag: 'Success'; readonly html: string }
  | { readonly _tag: 'Error'; readonly message: string };

const CIPHERTEXT: DecryptState = { _tag: 'Ciphertext' };
const DECRYPTING: DecryptState = { _tag: 'Decrypting' };
const success = (html: string): DecryptState => ({ _tag: 'Success', html });
const error = (message: string): DecryptState => ({ _tag: 'Error', message });

const getKeyFromUrl = (): string | null =>
  new URLSearchParams(window.location.search).get('key');

const toSafeHtml = (markdown: string): string =>
  DOMPurify.sanitize(marked.parse(markdown, { gfm: true }) as string);

export const PostContent: React.FC<Props> = ({ ciphertext }) => {
  const [state, setState] = useState<DecryptState>(CIPHERTEXT);
  const decryptedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = getKeyFromUrl();
    if (!key) {
      setState(CIPHERTEXT);
      return;
    }
    setState(DECRYPTING);
    decrypt(ciphertext, key)
      .then((plaintext) => setState(success(toSafeHtml(plaintext))))
      .catch((e: unknown) => {
        const message =
          e instanceof DecryptionError ? e.message : 'Unexpected decryption error.';
        setState(error(message));
      });
  }, [ciphertext]);

  // Animate decrypted content after React commits the new DOM.
  useEffect(() => {
    if (state._tag === 'Success' && decryptedRef.current) {
      animateElement(decryptedRef.current);
    }
  }, [state._tag]);

  switch (state._tag) {
    case 'Ciphertext':
      return <div>{ciphertext}</div>;

    case 'Decrypting':
      return <p className="post-decrypt-status">Decrypting…</p>;

    case 'Error':
      return <p className="post-decrypt-error">{state.message}</p>;

    case 'Success':
      return (
        <div
          ref={decryptedRef}
          className="prose dark:prose-invert prose-base max-w-none custom-md"
          // html is sanitized by DOMPurify before assignment
          dangerouslySetInnerHTML={{ __html: state.html }}
        />
      );
  }
};
