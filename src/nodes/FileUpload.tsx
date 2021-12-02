import * as React from "react";
import { /* Plugin, */ TextSelection, NodeSelection } from "prosemirror-state";
// import { InputRule } from "prosemirror-inputrules";
// import getDataTransferFiles from "../lib/getDataTransferFiles";
// import uploadPlaceholderPlugin from "../lib/uploadPlaceholder";
// import insertFiles from "../commands/insertFiles";
import Node from "./Node";

/**
 * Matches following attributes in Markdown-typed image: [, alt, src, class]
 *
 * Example:
 * ![Lorem](image.jpg) -> [, "Lorem", "image.jpg"]
 * ![](image.jpg "class") -> [, "", "image.jpg", "small"]
 * ![Lorem](image.jpg "class") -> [, "Lorem", "image.jpg", "small"]
 */
// const IMAGE_INPUT_REGEX = /!\[(?<alt>[^\]\[]*?)]\((?<filename>[^\]\[]*?)(?=\“|\))\“?(?<layoutclass>[^\]\[\”]+)?\”?\)$/;

// const uploadPlugin = options =>
//   new Plugin({
//     props: {
//       handleDOMEvents: {
//         paste(view, event: ClipboardEvent): boolean {
//           if (
//             (view.props.editable && !view.props.editable(view.state)) ||
//             !options.uploadFile
//           ) {
//             return false;
//           }

//           if (!event.clipboardData) return false;

//           // check if we actually pasted any files
//           const files = Array.prototype.slice
//             .call(event.clipboardData.items)
//             .map(dt => dt.getAsFile())
//             .filter(file => file);

//           if (files.length === 0) return false;

//           const { tr } = view.state;
//           if (!tr.selection.empty) {
//             tr.deleteSelection();
//           }
//           const pos = tr.selection.from;

//           insertFiles(view, event, pos, files, options);
//           return true;
//         },
//         drop(view, event: DragEvent): boolean {
//           if (
//             (view.props.editable && !view.props.editable(view.state)) ||
//             !options.uploadFile
//           ) {
//             return false;
//           }

//           // filter to only include image files
//           const files = getDataTransferFiles(event).filter(file =>
//             /image/i.test(file.type)
//           );
//           if (files.length === 0) {
//             return false;
//           }

//           // grab the position in the document for the cursor
//           const result = view.posAtCoords({
//             left: event.clientX,
//             top: event.clientY,
//           });

//           if (result) {
//             insertFiles(view, event, result.pos, files, options);
//             return true;
//           }

//           return false;
//         },
//       },
//     },
//   });

const IMAGE_CLASSES = ["right-50", "left-50"]; // ??????
const getLayoutAndTitle = tokenTitle => {
  if (!tokenTitle) return {};
  if (IMAGE_CLASSES.includes(tokenTitle)) {
    return {
      layoutClass: tokenTitle,
    };
  } else {
    return {
      title: tokenTitle,
    };
  }
};

export default class Image extends Node {
  get name() {
    return "file";
  }

  get schema() {
    return {
      inline: true,
      attrs: {
        src: {},
        layoutClass: {
          default: null,
        },
        title: {
          default: null,
        },
      },
      content: "text*",
      marks: "",
      group: "inline",
      selectable: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div[class~=image]",
          getAttrs: (dom: HTMLDivElement) => {
            const img = dom.getElementsByTagName("img")[0];
            const className = dom.className;
            const layoutClassMatched =
              className && className.match(/image-(.*)$/);
            const layoutClass = layoutClassMatched
              ? layoutClassMatched[1]
              : null;
            return {
              src: img?.getAttribute("src"),
              alt: img?.getAttribute("alt"),
              title: img?.getAttribute("title"),
              layoutClass: layoutClass,
            };
          },
        },
        {
          tag: "img",
          getAttrs: (dom: HTMLImageElement) => {
            return {
              src: dom.getAttribute("src"),
              alt: dom.getAttribute("alt"),
              title: dom.getAttribute("title"),
            };
          },
        },
      ],
      toDOM: node => {
        const className = node.attrs.layoutClass
          ? `image image-${node.attrs.layoutClass}`
          : "image";
        return [
          "div",
          {
            class: className,
          },
          ["img", { ...node.attrs, contentEditable: false }],
          ["p", { class: "caption" }, 0],
        ];
      },
    };
  }

  handleKeyDown = ({ node, getPos }) => event => {
    // Pressing Enter in the caption field should move the cursor/selection
    // below the image
    if (event.key === "Enter") {
      event.preventDefault();

      const { view } = this.editor;
      const $pos = view.state.doc.resolve(getPos() + node.nodeSize);
      view.dispatch(
        view.state.tr.setSelection(new TextSelection($pos)).split($pos.pos)
      );
      view.focus();
      return;
    }

    // Pressing Backspace in an an empty caption field should remove the entire
    // image, leaving an empty paragraph
    if (event.key === "Backspace" && event.target.innerText === "") {
      const { view } = this.editor;
      const $pos = view.state.doc.resolve(getPos());
      const tr = view.state.tr.setSelection(new NodeSelection($pos));
      view.dispatch(tr.deleteSelection());
      view.focus();
      return;
    }
  };

  handleBlur = ({ node, getPos }) => event => {
    const alt = event.target.innerText;
    const { src, title, layoutClass } = node.attrs;

    if (alt === node.attrs.alt) return;

    const { view } = this.editor;
    const { tr } = view.state;

    // update meta on object
    const pos = getPos();
    const transaction = tr.setNodeMarkup(pos, undefined, {
      src,
      alt,
      title,
      layoutClass,
    });
    view.dispatch(transaction);
  };

  handleSelect = ({ getPos }) => event => {
    event.preventDefault();

    const { view } = this.editor;
    const $pos = view.state.doc.resolve(getPos());
    const transaction = view.state.tr.setSelection(new NodeSelection($pos));
    view.dispatch(transaction);
  };

  component = props => {
    const { src, layoutClass } = props.node.attrs;
    const className = layoutClass ? `image image-${layoutClass}` : "image";

    return (
      <div contentEditable={false} className={className}>
        <a href={src}>{src}</a>
      </div>
    );
  };

  toMarkdown(state, node) {
    let markdown =
      " ![" +
      state.esc((node.attrs.alt || "").replace("\n", "") || "") +
      "](" +
      state.esc(node.attrs.src);
    if (node.attrs.layoutClass) {
      markdown += ' "' + state.esc(node.attrs.layoutClass) + '"';
    } else if (node.attrs.title) {
      markdown += ' "' + state.esc(node.attrs.title) + '"';
    }
    markdown += ")";
    state.write(markdown);
  }

  parseMarkdown() {
    return {
      node: "image",
      getAttrs: token => {
        return {
          src: token.attrGet("src"),
          alt: (token.children[0] && token.children[0].content) || null,
          ...getLayoutAndTitle(token.attrGet("title")),
        };
      },
    };
  }

  commands({ type }) {
    return {
      deleteFile: () => (state, dispatch) => {
        dispatch(state.tr.deleteSelection());
        return true;
      },
      alignRight: () => (state, dispatch) => {
        const attrs = {
          ...state.selection.node.attrs,
          title: null,
          layoutClass: "right-50",
        };
        const { selection } = state;
        dispatch(state.tr.setNodeMarkup(selection.from, undefined, attrs));
        return true;
      },
      alignLeft: () => (state, dispatch) => {
        const attrs = {
          ...state.selection.node.attrs,
          title: null,
          layoutClass: "left-50",
        };
        const { selection } = state;
        dispatch(state.tr.setNodeMarkup(selection.from, undefined, attrs));
        return true;
      },
      alignCenter: () => (state, dispatch) => {
        const attrs = { ...state.selection.node.attrs, layoutClass: null };
        const { selection } = state;
        dispatch(state.tr.setNodeMarkup(selection.from, undefined, attrs));
        return true;
      },
      createFile: attrs => (state, dispatch) => {
        const { selection } = state;
        const position = selection.$cursor
          ? selection.$cursor.pos
          : selection.$to.pos;
        const node = type.create(attrs);
        const transaction = state.tr.insert(position, node);
        dispatch(transaction);
        return true;
      },
    };
  }

  // inputRules({ type }) {
  //   return [
  //     new InputRule(IMAGE_INPUT_REGEX, (state, match, start, end) => {
  //       const [okay, alt, src, matchedTitle] = match;
  //       const { tr } = state;

  //       if (okay) {
  //         tr.replaceWith(
  //           start - 1,
  //           end,
  //           type.create({
  //             src,
  //             alt,
  //             ...getLayoutAndTitle(matchedTitle),
  //           })
  //         );
  //       }

  //       return tr;
  //     }),
  //   ];
  // }

  // get plugins() {
  //   return [uploadPlaceholderPlugin, uploadPlugin(this.options)];
  // }
}
