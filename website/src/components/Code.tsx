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
    <div className="bg-[#fffefc] dark:bg-[#141414] p-4 rounded-lg font-mono text-sm overflow-x-auto mb-4">
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
