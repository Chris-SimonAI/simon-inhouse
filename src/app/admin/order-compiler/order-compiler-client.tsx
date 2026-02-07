'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { runOrderCompilerPreview } from '@/actions/order-compiler';
import { type OrderCompilerRestaurantOption } from '@/lib/orders/order-compiler-types';

type CompilerRun = {
  id: string;
  prompt: string;
  state: 'loading' | 'done' | 'error';
  errorMessage?: string;
  data?: {
    selectedRestaurant: {
      restaurantGuid: string;
      restaurantName: string | null;
    };
    matches: Array<{
      requestText: string;
      quantity: number;
      selectedCandidate: {
        restaurantGuid: string;
        restaurantName: string;
        menuItemGuid: string;
        menuItemName: string;
        score: number;
        reason: string;
      } | null;
      candidates: Array<{
        restaurantGuid: string;
        restaurantName: string;
        menuItemGuid: string;
        menuItemName: string;
        score: number;
        reason: string;
      }>;
    }>;
    unmatchedRequests: string[];
    canonicalDraft: {
      restaurantGuid: string;
      items: Array<{
        menuItemGuid: string;
        quantity: number;
        selectedModifiers: Record<string, string[]>;
      }>;
    };
    compile: {
      status: 'ready_to_execute' | 'needs_user_input' | 'unfulfillable';
      subtotal: number;
      itemCount: number;
      issues: Array<{
        code: string;
        message: string;
        severity: 'needs_user_input' | 'unfulfillable';
      }>;
    } | null;
    compileError: string | null;
    searchStats: {
      menuItemsScanned: number;
      requestLinesParsed: number;
      restaurantsConsidered: number;
    };
  };
};

const scopeAllValue = '__all_restaurants__';

const demoPrompts = [
  'I want 2 spicy chicken sandwiches and fries',
  'something vegetarian and a coke',
  'one burger, no onions, and a side salad',
  'late night comfort food',
];

export function OrderCompilerClient({
  restaurants,
}: {
  restaurants: OrderCompilerRestaurantOption[];
}) {
  const [prompt, setPrompt] = useState('');
  const [selectedScope, setSelectedScope] = useState(scopeAllValue);
  const [runs, setRuns] = useState<CompilerRun[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedRestaurantLabel = useMemo(() => {
    if (selectedScope === scopeAllValue) {
      return 'All Restaurants';
    }

    const found = restaurants.find(
      (restaurant) => restaurant.restaurantGuid === selectedScope,
    );
    if (!found) {
      return 'All Restaurants';
    }

    if (found.hotelName) {
      return `${found.restaurantName} (${found.hotelName})`;
    }

    return found.restaurantName;
  }, [restaurants, selectedScope]);

  function handleRunCompiler() {
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0 || isPending) {
      return;
    }

    const runId = crypto.randomUUID();
    const optimisticRun: CompilerRun = {
      id: runId,
      prompt: trimmedPrompt,
      state: 'loading',
    };

    setRuns((previousRuns) => [...previousRuns, optimisticRun]);
    setPrompt('');

    startTransition(async () => {
      const result = await runOrderCompilerPreview({
        message: trimmedPrompt,
        restaurantGuid:
          selectedScope === scopeAllValue ? undefined : selectedScope,
      });

      setRuns((previousRuns) =>
        previousRuns.map((run) => {
          if (run.id !== runId) {
            return run;
          }

          if (!result.ok) {
            return {
              ...run,
              state: 'error',
              errorMessage: result.message,
            } satisfies CompilerRun;
          }

          return {
            ...run,
            state: 'done',
            data: result.data,
          } satisfies CompilerRun;
        }),
      );
    });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Order Compiler</h1>
            <p className="text-sm text-slate-500">
              Demo natural-language to canonical order compilation against your live menu index.
            </p>
          </div>
          <Badge variant="outline" className="text-slate-600">
            Dry Run
          </Badge>
        </div>
      </div>

      <div className="p-6 border-b border-slate-200 bg-slate-50/60">
        <div className="grid gap-4 md:grid-cols-[minmax(260px,340px)_1fr]">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Search Scope
            </p>
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger>
                <SelectValue placeholder="Select restaurant scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={scopeAllValue}>All Restaurants</SelectItem>
                {restaurants.map((restaurant) => (
                  <SelectItem
                    key={restaurant.restaurantGuid}
                    value={restaurant.restaurantGuid}
                  >
                    {restaurant.hotelName
                      ? `${restaurant.restaurantName} (${restaurant.hotelName})`
                      : restaurant.restaurantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Current scope: {selectedRestaurantLabel}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Guest Input
            </p>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: I want 2 chicken sandwiches and one coke"
              className="min-h-[110px] bg-white"
            />
            <div className="flex flex-wrap gap-2">
              {demoPrompts.map((samplePrompt) => (
                <button
                  key={samplePrompt}
                  type="button"
                  className="text-xs rounded-full border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100 text-slate-700"
                  onClick={() => setPrompt(samplePrompt)}
                >
                  {samplePrompt}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleRunCompiler} disabled={isPending || prompt.trim().length === 0}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Compile Preview
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <ScrollArea className="h-[calc(100vh-320px)] pr-2">
          <div className="space-y-6">
            {runs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <Sparkles className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">
                  Run a prompt to see parsed requests, menu matches, canonical draft, and compile status.
                </p>
              </div>
            ) : null}

            {runs.map((run) => (
              <div key={run.id} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-slate-900 text-white px-4 py-3 text-sm">
                    {run.prompt}
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="max-w-[92%] w-full">
                    {run.state === 'loading' ? (
                      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running compiler preview...
                      </div>
                    ) : null}

                    {run.state === 'error' ? (
                      <div className="rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {run.errorMessage ?? 'Compiler failed'}
                      </div>
                    ) : null}

                    {run.state === 'done' && run.data ? (
                      <CompilerRunResultCard run={run.data} />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function CompilerRunResultCard({ run }: { run: NonNullable<CompilerRun['data']> }) {
  const compileBadgeClass = getCompileBadgeClass(run.compile?.status ?? null);

  return (
    <Card className="rounded-2xl rounded-tl-sm border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span>Compiler Trace</span>
          <Badge className={compileBadgeClass}>
            {run.compile?.status ?? 'not_compiled'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Selected Restaurant</p>
            <p className="font-medium text-slate-900">
              {run.selectedRestaurant.restaurantName ?? run.selectedRestaurant.restaurantGuid}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Search Stats</p>
            <p className="text-slate-700">
              {run.searchStats.menuItemsScanned} items, {run.searchStats.restaurantsConsidered} restaurants, {run.searchStats.requestLinesParsed} request lines
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Parsed Requests & Matches</p>
          {run.matches.map((match) => (
            <div key={`${match.requestText}-${match.quantity}`} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-slate-900">
                  &quot;{match.requestText}&quot; (qty {match.quantity})
                </p>
                {match.selectedCandidate ? (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                    {match.selectedCandidate.menuItemName} · {match.selectedCandidate.score}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-700 border-red-300">
                    No selected match
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {match.candidates.map((candidate) => (
                  <div
                    key={`${match.requestText}-${candidate.menuItemGuid}`}
                    className="text-xs text-slate-600 rounded bg-slate-50 px-2 py-1 flex items-center justify-between gap-2"
                  >
                    <span>
                      {candidate.menuItemName} · {candidate.restaurantName}
                    </span>
                    <span>{candidate.score} ({candidate.reason})</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Canonical Draft Items</p>
            <div className="space-y-1">
              {run.canonicalDraft.items.length === 0 ? (
                <p className="text-sm text-slate-500">No draft items produced.</p>
              ) : (
                run.canonicalDraft.items.map((item) => (
                  <div key={item.menuItemGuid} className="text-sm text-slate-700">
                    {item.quantity}x {item.menuItemGuid}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Compile Outcome</p>
            {run.compileError ? (
              <p className="text-sm text-red-700">{run.compileError}</p>
            ) : null}
            {run.compile ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">
                  {run.compile.itemCount} items · subtotal ${run.compile.subtotal.toFixed(2)}
                </p>
                {run.compile.issues.length > 0 ? (
                  <div className="space-y-1">
                    {run.compile.issues.map((issue) => (
                      <div key={`${issue.code}-${issue.message}`} className="text-xs text-slate-700 bg-slate-50 rounded px-2 py-1">
                        [{issue.severity}] {issue.code}: {issue.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700">No compile issues.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {run.unmatchedRequests.length > 0 ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs text-orange-700 uppercase tracking-wide mb-1">Unmatched Request Lines</p>
            {run.unmatchedRequests.map((line) => (
              <p key={line} className="text-sm text-orange-800">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getCompileBadgeClass(
  status: 'ready_to_execute' | 'needs_user_input' | 'unfulfillable' | null,
): string {
  if (status === 'ready_to_execute') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  }

  if (status === 'needs_user_input') {
    return 'bg-amber-100 text-amber-700 border-amber-300';
  }

  if (status === 'unfulfillable') {
    return 'bg-red-100 text-red-700 border-red-300';
  }

  return 'bg-slate-100 text-slate-700 border-slate-300';
}
