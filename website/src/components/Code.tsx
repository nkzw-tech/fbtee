import { createHighlighter, ThemeRegistrationResolved } from 'shiki';
import Licht from '../themes/licht.json' with { type: 'json' };
import Dunkel from '../themes/dunkel.json' with { type: 'json' };

const highlighter = await createHighlighter({
  langs: ['js', 'ts', 'tsx'],
  themes: [
    Licht as unknown as ThemeRegistrationResolved,
    Dunkel as unknown as ThemeRegistrationResolved,
  ],
});

export default function Code({ code }: { code: string }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-lg bg-[#fffefc] p-4 font-mono text-sm dark:bg-[#141414]">
      <div
        dangerouslySetInnerHTML={{
          __html: highlighter.codeToHtml(code, {
            lang: 'tsx',
            themes: {
              dark: 'Dunkel',
              light: 'Licht',
            },
          }),
        }}
      />
    </div>
  );
}
