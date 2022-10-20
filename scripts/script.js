function invoke(action, version, params = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener("error", () => reject("failed to issue request"));
    xhr.addEventListener("load", () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (Object.getOwnPropertyNames(response).length != 2) {
          throw "response has an unexpected number of fields";
        }
        if (!response.hasOwnProperty("error")) {
          throw "response is missing required error field";
        }
        if (!response.hasOwnProperty("result")) {
          throw "response is missing required result field";
        }
        if (response.error) {
          throw response.error;
        }
        resolve(response.result);
      } catch (e) {
        console.log(e);
        reject(e);
      }
    });
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        //if complete
        if (xhr.status === 200) {
          //check if "OK" (200)
          //success
        } else {
          error_handle_function(); //otherwise, some other code was returned
        }
      }
    };
    xhr.open("POST", "http://127.0.0.1:8765");
    xhr.setRequestHeader("Access-Control-Allow-Headers", "*");
    xhr.send(JSON.stringify({ action, version, params }));
  });
}

function error_handle_function() {
  window.alert(
    'Failed to connect to Anki. Make sure Anki is running in the background and has AnkiConnect installed. Ensure that "null" is in the webCorsOriginList in your AnkiConnects configuration'
  );
}
function successful_connection_function() {}

let startDiv; // first div for form
let nextDiv; // next step div
let lastStepDiv; // final div for form
let learnWordList = n3WordList; // n3WordList or dicWordList
let frequencyList = obj; // dicFreq or obj
let ankiProfile = []; // information about users configuration
let blackList = []; // words to not render in final list
let knownWords = []; // words already in anki
let learnWords = []; // words of final list
if (!!loadLocalStorage("blackListStorage")) {
  blackList = loadLocalStorage("blackListStorage");
}
if (!!localStorage.getItem("ankiProfileStorage")) {
  ankiProfile = loadLocalStorage("ankiProfileStorage");
  rebuildPage();
} else {
  startLoad();
}

// cleans up the word list. So strings like "こと《事》" get tured into "事"
for (var i = 0; i < learnWordList.length; i++) {
  if (learnWordList.at(i).includes("《")) {
    //learnWords.at(i).replace(learnWords.at(i).substring(learnWords.at(i).indexOf("《"), learnWords.at(i).length), "");
    learnWordList[i] = learnWordList
      .at(i)
      .substring(
        learnWordList.at(i).indexOf("《") + 1,
        learnWordList.at(i).indexOf("》")
      );
  }
}

function listToQuery(list, i) {
  let string = "";
  string += '"deck:' + list[i].deck + '"';
  return string;
}

async function fooFunc() {
  /*miningList = [];
    jp1kList = [];*/
  learnWords = [];
  for (let i = 0; i < ankiProfile.length; i++) {
    const p1 = await invoke("findCards", 6, {
      query: listToQuery(ankiProfile, i),
    });
    const resultCardIDs = await p1; // all card IDs for cards in i:th deck of ankiProfile
    const p2 = await invoke("cardsInfo", 6, { cards: resultCardIDs });
    const result = await p2; // arraylist for all cards in i:th deck of ankiProfile
    for (var c = 0; c < result.length; c++) {
      const field = ankiProfile[i].field;
      //Function('knownWords.push(result[c].fields.' + field + '.value)');
      //knownWords.push(result[c].fields.);
      eval("knownWords.push(result[c].fields." + field + ".value)");
    }
  }
  console.log(knownWords);
  for (var i = 0; i < learnWordList.length; i++) {
    if (knownWords.includes(learnWordList.at(i))) {
      console.log("Ordet finns redan. Skippar...");
    } else if (blackList.includes(learnWordList.at(i))) {
      console.log("Ordet är bannlyst");
    } else {
      const frequency = findRow(learnWordList[i], frequencyList) + 1;
      learnWords.push({
        word: learnWordList[i],
        frequency: frequency,
      });
    }
  }
  learnWords.sort((a, b) => a.frequency - b.frequency);
  resultConsoleLog(ankiProfile.toString());
  updateList();
}

async function wordExistsMining(learnWord) {
  const p = await invoke("findCards", 6, {
    query: `deck:日本語::Mining Word:${learnWord}`,
  });
  const result = await p;
  if (Object.keys(result).length != 0) {
    console.log("Borde returna: ", true);
    return true;
  } else {
    console.log("Borde returna: ", false);
    return false;
  }

  return await invoke("findCards", 6, {
    query: `deck:日本語::Mining Word:${learnWord}`,
  }).then((result) => {
    if (Object.keys(result).length != 0) {
      console.log("Borde returna: ", true);
      return true;
    } else {
      console.log("Borde returna: ", false);
      return false;
    }
  });
}

async function init() {
  for (var i = 0; i < learnWordList.length; i++) {
    // Om ordet i learnWordList på pos i redan finns i Anki
    const exists = await wordExistsMining(learnWordList[i]);
    if (exists) {
      console.log("Ord finns redan. Skippar...");
    } else if (blackList.includes(learnWordList[i])) {
      console.log("Ordet är bannlyst");
    } else {
      console.log("Lägger till");
      learnWords.push(learnWordList[i]);
    }
    //if (i > 10) break;
  }

  updateList();
}

function updateList() {
  document.getElementById("wordList").textContent = "";
  // makes the list into a string with line breaks after every word
  let listFormat = "";
  for (var i = 0; i < learnWords.length; i++) {
    listFormat += learnWords[i].word + "\n";
  }
  document.getElementById("wordList").textContent = listFormat;
  console.log(learnWords.length);
}

// like includes() but for this multidimensional array
function multiArrayIncludes(term) {
  for (var i = 0; i < learnWords.length; i++) {
    if (learnWords[i].word == term) {
      return true;
    }
  }
  return false;
}

function searchWord() {
  let searchTerm = document.getElementById("searchField").value.trim();
  if (multiArrayIncludes(searchTerm)) {
    resultConsoleLog(`N3 word list includes: '${searchTerm}'`);
  } else if (knownWords.includes(searchTerm)) {
    resultConsoleLog(`You already know '${searchTerm}'`);
  } else {
    resultConsoleLog("Word does not exist in any known list");
  }
}

function countString(str, letter) {
  let count = 0;
  // looping through the items
  for (var i = 0; i < str.length; i++) {
    // check if the character is at that position
    if (str.charAt(i) == letter) {
      count++;
    }
  }
  return count;
}

function listToString(list) {
  const newString = list.toString();
  return newString;
}

function stringToList(string) {
  const newList = string.split(",");
  return newList;
}

function saveLocalStorage(list, key) {
  const storageFormat = JSON.stringify(list);
  localStorage.setItem(key, storageFormat);
  console.log("Saved!");
}

function loadLocalStorage(key) {
  const returnContent = localStorage.getItem(key);
  list = JSON.parse(returnContent);
  return list;
  console.log("Loaded!");
}

function resetLocalStorage(key) {
  localStorage.setItem(key, "");
  console.log("Reset!");
}

function indecesOfChar(str, letter) {
  var indices = [];
  for (var i = 0; i < str.length; i++) {
    if (str[i] === letter) indices.push(i);
  }
  return indices;
}

function removeWord() {
  let words = wordToRemove(
    document.getElementById("removeField").value.trim(),
    " "
  );
  blackList = words.concat(blackList);
  for (var i = 0; i < words.length; i++) {
    if (multiArrayIncludes(words[i])) {
      const index = findRow2(words[i], learnWords);
      learnWords.splice(index, 1);
      resultConsoleLog("Success");
    } else {
      resultConsoleLog("List does not include word");
    }
  }
  updateList();
  document.getElementById("removeField").value = "";
}

function resultConsoleLog(string) {
  document.getElementById("searchResult").textContent = string;
  setTimeout(function () {
    // Something you want delayed.
    document.getElementById("searchResult").textContent = "";
  }, 2500); // How long you want the delay to be, measured in milliseconds.
}

function wordToRemove(str, letter) {
  let indeces = indecesOfChar(str, letter);
  let wordsToRemove = [];
  for (var i = 0; i < indeces.length + 1; i++) {
    if (i == 0) {
      wordsToRemove[i] = str.substring(0, indeces[0]);
    } else {
      wordsToRemove[i] = str.substring(indeces[i - 1] + 1, indeces[i]);
    }
  }
  return wordsToRemove;
}

function findRow(string, list) {
  for (var i = 0; i < list.length; i++) {
    if (string == list[i][0]) {
      return i;
    }
  }
}

function findRow2(string, list) {
  for (var i = 0; i < list.length; i++) {
    if (string == list[i].word) {
      return i;
    }
  }
}

function sortFrequency() {
  for (var i = 0; i < learnWords.length; i++) {
    learnWords[i].frequency = findRow(learnWords[i], frequencyList) + 1;
  }
}

async function startLoad() {
  document.getElementById("hideOrShow").setAttribute("style", "display: none;");
  const deckNamesObj = await invoke("deckNamesAndIds", 6);
  ankiProfile = [];
  var deckNamesObjList = Object.entries(deckNamesObj);
  startDiv = document.createElement("div");
  startDiv.innerHTML =
    "<div>Select what deck(s) contain your known words:</div>";
  let multiselect = document.createElement("div");
  multiselect.classList.add("multiselect");
  for (let i = 0; i < deckNamesObjList.length; i++) {
    let inputElm = document.createElement("input");
    let labelElm = document.createElement("label");
    inputElm.setAttribute("type", "checkbox");
    inputElm.setAttribute("name", "deckCheckbox");
    inputElm.setAttribute("value", deckNamesObjList[i][0]);
    labelElm.appendChild(inputElm);
    labelElm.innerHTML += deckNamesObjList[i][0];
    multiselect.appendChild(labelElm);
    //multiselect.appendChild(document.createElement('br'));
  }
  let submitButton = document.createElement("button");
  submitButton.setAttribute("onclick", "decklistNext()");
  submitButton.innerHTML = "Next";
  multiselect.appendChild(submitButton);
  startDiv.appendChild(multiselect);
  document.getElementById("container").appendChild(startDiv);
}

async function decklistNext() {
  const checkedBoxes = document.querySelectorAll(
    "input[name=deckCheckbox]:checked"
  );
  if (checkedBoxes.length == 0) {
    console.log("Check at least one box");
    return;
  } else {
    const modelNames = await invoke("modelNames", 6);
    nextDiv = document.createElement("div");
    nextDiv.innerHTML =
      "<div>Select what note types you use in your respective decks:</div>";
    for (let i = 0; i < checkedBoxes.length; i++) {
      let multiselect = document.createElement("div");
      multiselect.classList.add("multiselect");
      multiselect.setAttribute("style", "display: inline-block;");
      multiselect.innerHTML +=
        "<p style='font-weight: bold;'>" + checkedBoxes[i].value + "</p>";
      for (let i2 = 0; i2 < modelNames.length; i2++) {
        let inputElm = document.createElement("input");
        let labelElm = document.createElement("label");
        inputElm.setAttribute("type", "radio");
        inputElm.setAttribute("name", "noteRadio" + checkedBoxes[i].value);
        inputElm.setAttribute("value", modelNames[i2]);
        labelElm.appendChild(inputElm);
        labelElm.innerHTML += modelNames[i2];
        multiselect.appendChild(labelElm);
      }
      nextDiv.appendChild(multiselect);
    }
    let submitButton = document.createElement("input");
    submitButton.type = "button";
    submitButton.value = "Next";
    submitButton.classList = "button";
    submitButton.addEventListener("click", function () {
      lastStep(checkedBoxes);
    });
    nextDiv.appendChild(document.createElement("br"));
    nextDiv.appendChild(submitButton);
    startDiv.outerHTML = "";
    document.getElementById("container").appendChild(nextDiv);
  }
}

async function lastStep(checkedBoxesDecks) {
  if (checkedBoxesDecks.length == 0) {
    console.log("Select an option");
  } else {
    for (let i = 0; i < checkedBoxesDecks.length; i++) {
      ankiProfile.push({
        deck: checkedBoxesDecks[i].value,
        modelType: document.querySelector(
          `input[name="noteRadio${checkedBoxesDecks[i].value}"]:checked`
        ).value,
        field: "",
      });
    }
    lastStepDiv = document.createElement("div");
    lastStepDiv.innerHTML =
      "<div>Select the field with the pure word in each deck:</div>";
    for (let i = 0; i < ankiProfile.length; i++) {
      const modelNames = await invoke("modelFieldNames", 6, {
        modelName: ankiProfile[i].modelType,
      });
      let multiselect = document.createElement("div");
      multiselect.classList.add("multiselect");
      multiselect.setAttribute("style", "display: inline-block;");
      multiselect.innerHTML +=
        "<p style='font-weight: bold;'>" + ankiProfile[i].deck + "</p>";
      for (let c = 0; c < modelNames.length; c++) {
        let inputElm = document.createElement("input");
        let labelElm = document.createElement("label");
        inputElm.setAttribute("type", "radio");
        inputElm.setAttribute("name", "noteRadio" + ankiProfile[i].deck);
        inputElm.setAttribute("value", modelNames[c]);
        labelElm.appendChild(inputElm);
        labelElm.innerHTML += modelNames[c];
        multiselect.appendChild(labelElm);
      }
      lastStepDiv.appendChild(multiselect);
    }
    let submitButton = document.createElement("input");
    submitButton.type = "button";
    submitButton.value = "Done";
    submitButton.classList = "button";
    submitButton.addEventListener("click", function () {
      clear();
      saveLocalStorage(ankiProfile, "ankiProfileStorage");
    });
    lastStepDiv.appendChild(document.createElement("br"));
    lastStepDiv.appendChild(submitButton);
    nextDiv.outerHTML = "";
    document.getElementById("container").appendChild(lastStepDiv);
  }
}

function clear() {
  for (let i = 0; i < ankiProfile.length; i++) {
    const checkedBoxes = document.querySelectorAll(
      `input[name="noteRadio${ankiProfile[i].deck}"]:checked`
    );
    ankiProfile[i].field = checkedBoxes[0].value;
  }
  for (let i = 0; i < ankiProfile.length; i++) {
    const listWordString =
      ankiProfile[i].deck.replace(/([^a-z0-9]+)/gi, "") + "List";
    console.log(listWordString);
    eval("window." + listWordString + "= " + " []" + ";");
  }
  lastStepDiv.outerHTML = "";
  rebuildPage();
}

function rebuildPage() {
  document.getElementById("hideOrShow").style.display = "block";
  document.getElementById("wordList").textContent =
    "Generating list... Please wait";
  fooFunc();
}

window.addEventListener("DOMContentLoaded", function () {
  document.getElementById("container").style.display = "block";
});
