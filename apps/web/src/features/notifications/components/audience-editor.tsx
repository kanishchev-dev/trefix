"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import { Checkbox } from "@trefix/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@trefix/ui/components/item";
import { Tabs, TabsList, TabsTrigger } from "@trefix/ui/components/tabs";
import { PlusIcon, XIcon } from "lucide-react";

import {
  BROADCAST_AUDIENCE_TYPES,
  PUSH_PLATFORMS,
  type BroadcastAudienceInput,
  type BroadcastAudienceType,
  type PushPlatform,
} from "@trefix/api-client";

import { fetchGroups } from "@/entities/permission/api";
import { fetchUsers } from "@/entities/user/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

type Language = "ru" | "en";
const LANGUAGES: readonly Language[] = ["ru", "en"];
type PlanFilter = "any" | "yes" | "no";

export type SelectedUser = { id: string; name: string; email: string };

/** Everything the audience form edits; turned into the API shape by `toAudience`. */
export type AudienceState = {
  type: BroadcastAudienceType;
  users: SelectedUser[];
  groupId: string;
  languages: Language[];
  platforms: PushPlatform[];
  registeredFrom: string;
  registeredTo: string;
  activePlan: PlanFilter;
};

export const EMPTY_AUDIENCE: AudienceState = {
  type: "users",
  users: [],
  groupId: "",
  languages: [],
  platforms: [],
  registeredFrom: "",
  registeredTo: "",
  activePlan: "any",
};

/** The API audience, or null while the form cannot describe one yet. */
export function toAudience(
  state: AudienceState,
): BroadcastAudienceInput | null {
  switch (state.type) {
    case "users":
      return state.users.length > 0
        ? { type: "users", userIds: state.users.map((user) => user.id) }
        : null;
    case "group":
      return state.groupId ? { type: "group", groupId: state.groupId } : null;
    case "all":
      return { type: "all" };
    case "segment":
      return {
        type: "segment",
        segment: {
          ...(state.languages.length ? { languages: state.languages } : {}),
          ...(state.platforms.length ? { platforms: state.platforms } : {}),
          ...(state.registeredFrom
            ? { registeredFrom: state.registeredFrom }
            : {}),
          ...(state.registeredTo ? { registeredTo: state.registeredTo } : {}),
          ...(state.activePlan !== "any"
            ? { activePlan: state.activePlan === "yes" }
            : {}),
        },
      };
  }
}

function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  return on
    ? [...new Set([...list, value])]
    : list.filter((item) => item !== value);
}

function UserPicker({
  value,
  onChange,
}: {
  value: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
}): ReactElement {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const results = useQuery({
    queryKey: ["notifications", "user-search", debounced],
    queryFn: () => fetchUsers({ search: debounced, limit: 6, page: 1 }),
    enabled: debounced.length >= 2,
  });
  const chosen = new Set(value.map((user) => user.id));
  const found = (results.data?.data ?? []).filter(
    (user) => !chosen.has(user.id) && user.status === "active",
  );

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={search}
        placeholder={t("notifications.audience.searchUsers")}
        onChange={(event) => setSearch(event.target.value)}
      />
      {debounced.length >= 2 ? (
        found.length > 0 ? (
          <ItemGroup className="gap-1">
            {found.map((user) => {
              const name = `${user.firstName} ${user.lastName}`.trim();
              return (
                <Item key={user.id} size="sm" variant="outline">
                  <ItemContent>
                    <ItemTitle>{name || user.email}</ItemTitle>
                    <ItemDescription>{user.email}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("common.actions.create")}
                      onClick={() =>
                        onChange([
                          ...value,
                          {
                            id: user.id,
                            name: name || user.email,
                            email: user.email,
                          },
                        ])
                      }
                    >
                      <PlusIcon />
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        ) : results.isFetching ? null : (
          <p className="text-sm text-muted-foreground">
            {t("notifications.audience.noUsersFound")}
          </p>
        )
      ) : null}
      {value.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {t("notifications.audience.selectedUsers", { count: value.length })}
          </p>
          <div className="flex flex-wrap gap-1">
            {value.map((user) => (
              <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                {user.name}
                <button
                  type="button"
                  aria-label={t("common.actions.delete")}
                  className="rounded-full p-0.5 hover:bg-muted"
                  onClick={() =>
                    onChange(value.filter((item) => item.id !== user.id))
                  }
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (groupId: string) => void;
}): ReactElement {
  const { t } = useI18n();
  const groups = useQuery({
    queryKey: ["notifications", "groups"],
    queryFn: () => fetchGroups(1, 100),
  });
  const options = (groups.data?.data ?? []).map((group) => ({
    value: group.id,
    label: group.name,
  }));

  return (
    <Field>
      <FieldLabel htmlFor="audience-group">
        {t("notifications.audience.group")}
      </FieldLabel>
      <OptionSelect
        id="audience-group"
        value={value}
        options={[
          { value: "", label: t("notifications.audience.groupPlaceholder") },
          ...options,
        ]}
        onValueChange={onChange}
        disabled={groups.isLoading}
      />
    </Field>
  );
}

function SegmentFields({
  value,
  onChange,
}: {
  value: AudienceState;
  onChange: (patch: Partial<AudienceState>) => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <FieldGroup className="gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSet>
          <FieldLegend variant="label">
            {t("notifications.audience.languages")}
          </FieldLegend>
          <div className="flex gap-4">
            {LANGUAGES.map((language) => (
              <Field key={language} orientation="horizontal">
                <Checkbox
                  id={`segment-language-${language}`}
                  checked={value.languages.includes(language)}
                  onCheckedChange={(checked) =>
                    onChange({
                      languages: toggle(
                        value.languages,
                        language,
                        checked === true,
                      ),
                    })
                  }
                />
                <FieldLabel
                  htmlFor={`segment-language-${language}`}
                  className="font-normal"
                >
                  {t(`notifications.content.languages.${language}`)}
                </FieldLabel>
              </Field>
            ))}
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">
            {t("notifications.audience.platforms")}
          </FieldLegend>
          <div className="flex gap-4">
            {PUSH_PLATFORMS.map((platform) => (
              <Field key={platform} orientation="horizontal">
                <Checkbox
                  id={`segment-platform-${platform}`}
                  checked={value.platforms.includes(platform)}
                  onCheckedChange={(checked) =>
                    onChange({
                      platforms: toggle(
                        value.platforms,
                        platform,
                        checked === true,
                      ),
                    })
                  }
                />
                <FieldLabel
                  htmlFor={`segment-platform-${platform}`}
                  className="font-normal"
                >
                  {t(`notifications.user.platforms.${platform}`)}
                </FieldLabel>
              </Field>
            ))}
          </div>
        </FieldSet>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="segment-from">
            {t("notifications.audience.registeredFrom")}
          </FieldLabel>
          <Input
            id="segment-from"
            type="date"
            value={value.registeredFrom}
            onChange={(event) =>
              onChange({ registeredFrom: event.target.value })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="segment-to">
            {t("notifications.audience.registeredTo")}
          </FieldLabel>
          <Input
            id="segment-to"
            type="date"
            value={value.registeredTo}
            onChange={(event) => onChange({ registeredTo: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="segment-plan">
            {t("notifications.audience.activePlan")}
          </FieldLabel>
          <OptionSelect
            id="segment-plan"
            value={value.activePlan}
            options={(["any", "yes", "no"] as const).map((option) => ({
              value: option,
              label: t(`notifications.audience.activePlanOptions.${option}`),
            }))}
            onValueChange={(activePlan) => onChange({ activePlan })}
          />
        </Field>
      </div>
      <FieldDescription>
        {t("notifications.audience.segmentHint")}
      </FieldDescription>
    </FieldGroup>
  );
}

/** Who gets the notification: chosen users, a group, a segment or everyone. */
export function AudienceEditor({
  value,
  onChange,
}: {
  value: AudienceState;
  onChange: (next: AudienceState) => void;
}): ReactElement {
  const { t } = useI18n();
  const patch = (next: Partial<AudienceState>) =>
    onChange({ ...value, ...next });

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={value.type}
        onValueChange={(type) => patch({ type: type as BroadcastAudienceType })}
      >
        <TabsList>
          {BROADCAST_AUDIENCE_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {t(`notifications.audience.types.${type}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {value.type === "users" ? (
        <UserPicker
          value={value.users}
          onChange={(users) => patch({ users })}
        />
      ) : null}
      {value.type === "group" ? (
        <GroupPicker
          value={value.groupId}
          onChange={(groupId) => patch({ groupId })}
        />
      ) : null}
      {value.type === "segment" ? (
        <SegmentFields value={value} onChange={patch} />
      ) : null}
    </div>
  );
}
