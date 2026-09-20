import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testy dzielą jedną bazę SQLite i mutują stany magazynowe, więc muszą
    // iść po kolei w jednym procesie — równoległość dawałaby wyścigi.
    // W Vitest 5 `poolOptions` już nie istnieje: opcje puli są na górnym
    // poziomie (`singleFork`), a `fileParallelism: false` pilnuje kolejności.
    fileParallelism: false,
    pool: 'forks',
    singleFork: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
