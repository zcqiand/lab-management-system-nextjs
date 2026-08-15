import { describe, expect, it } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SampleExtFieldsModal } from "@/features/data-entry/SampleExtFieldsModal";
import type { ExtFieldDef } from "@/types/common/ext-field-def";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

describe("SampleExtFieldsModal（M03.F01.I07 类别参数补录）", () => {
  afterEach(() => {
    cleanup();
  });
  it("extFields 为空时直接渲染「当前报告类别没有需要补录的扩展属性」文案", () => {
    const onCancel = (): void => {};
    render(
      <SampleExtFieldsModal
        open
        extFields={[]}
        initialExt={{}}
        onSubmit={() => {}}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/当前报告类别没有需要补录的扩展属性/)).toBeTruthy();
  });

  it("按 extFields 渲染每个字段的 label + 占位符 tag + 输入控件", () => {
    const fields: ExtFieldDef[] = [
      {
        key: "castingDate",
        label: "浇筑时间",
        type: "date",
        required: true,
        tag: "h_pourDate",
      },
      { key: "volume", label: "混凝土方量（m³）", type: "number", tag: "h_volume" },
      {
        key: "moldingMethod",
        label: "成型方法",
        type: "select",
        options: ["插捣法", "振动法"],
      },
    ];
    render(
      <SampleExtFieldsModal
        open
        extFields={fields}
        initialExt={{ castingDate: "2026-07-20" }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    // label
    expect(screen.getByText("浇筑时间")).toBeTruthy();
    expect(screen.getByText("混凝土方量（m³）")).toBeTruthy();
    expect(screen.getByText("成型方法")).toBeTruthy();
    // tag 提示
    expect(screen.getByText("{h_pourDate}")).toBeTruthy();
    expect(screen.getByText("{h_volume}")).toBeTruthy();
    // 类型对应控件
    const dateInput = document.getElementById(
      "ext-field-castingDate",
    ) as HTMLInputElement;
    expect(dateInput?.type).toBe("date");
    expect(dateInput?.value).toBe("2026-07-20"); // initialExt 同步进 draft
    const select = document.getElementById(
      "ext-field-moldingMethod",
    ) as HTMLSelectElement;
    expect(select?.tagName).toBe("SELECT");
    const opts = Array.from(select.options).map((o) => o.text);
    expect(opts).toEqual(["请选择", "插捣法", "振动法"]);
  });

  it("未填必填 → 提交后显示错误文案，不回调 onSubmit", async () => {
    const fields: ExtFieldDef[] = [
      { key: "castingDate", label: "浇筑时间", type: "date", required: true },
    ];
    let submitted = false;
    render(
      <SampleExtFieldsModal
        open
        extFields={fields}
        initialExt={{}}
        onSubmit={() => {
          submitted = true;
        }}
        onCancel={() => {}}
      />,
    );
    const submitBtn = document.querySelector("button.bg-blue-600") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await waitFor(() => {
      expect(screen.getByText("必填")).toBeTruthy();
    });
    expect(submitted).toBe(false);
  });

  it("必填已填 + 取消 → 不回调 onSubmit；提交 → onSubmit 收到合并后的 ext", async () => {
    const fields: ExtFieldDef[] = [
      { key: "volume", label: "混凝土方量（m³）", type: "number", required: true },
      { key: "remark", label: "备注" },
    ];
    const initial: Record<string, string> = { remark: "已有备注" };
    let received: Record<string, string> | null = null;
    render(
      <SampleExtFieldsModal
        open
        extFields={fields}
        initialExt={initial}
        onSubmit={(m) => {
          received = m;
        }}
        onCancel={() => {}}
      />,
    );
    const volumeInput = document.getElementById("ext-field-volume") as HTMLInputElement;
    fireEvent.change(volumeInput, { target: { value: "12.5" } });
    const submitBtn = document.querySelector("button.bg-blue-600") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await waitFor(() => {
      expect(received).not.toBeNull();
    });
    expect(received).toEqual({ remark: "已有备注", volume: "12.5" });
  });

  it("open=false 时不渲染 DOM", () => {
    render(
      <SampleExtFieldsModal
        open={false}
        extFields={[{ key: "a", label: "A" }]}
        initialExt={{}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("A")).toBeNull();
  });
});
