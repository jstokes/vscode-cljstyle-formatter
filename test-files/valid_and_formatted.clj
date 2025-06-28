(ns test.valid-and-formatted
  (:require [clojure.string :as str]))

(defn my-function
  "This is a well-formatted function."
  [x y]
  (let [sum (+ x y)
        product (* x y)]
    (str/join " " ["Sum:" sum "Product:" product])))

(defonce my-atom (atom {:a 1 :b 2}))

(comment
  (my-function 10 20)
  (reset! my-atom {:a 100 :b 200})
  ,)
