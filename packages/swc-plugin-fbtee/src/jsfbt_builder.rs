use std::{
    collections::{HashMap, VecDeque},
    vec,
};

use swc_core::common::Span;

use crate::nodes::arguments::{CandidateValues, SVArgValue, StringVariationArg};

#[derive(Clone)]
pub struct Combo {
    pub value: SVArgValue,
    pub is_collapsible: bool,
}

pub struct JSFbtBuilder {
    used_enums: HashMap<Span, String>,
    string_variation_args: VecDeque<StringVariationArg>,
}

impl JSFbtBuilder {
    pub fn new(string_variation_args: Vec<StringVariationArg>) -> Self {
        Self {
            used_enums: HashMap::new(),
            string_variation_args: VecDeque::from(string_variation_args),
        }
    }

    // iterative version
    pub fn __get_string_variation_combinations(&self) -> Vec<Vec<Combo>> {
        let mut result: Vec<Vec<Combo>> = vec![];

        let mut used_enums: HashMap<Span, String> = HashMap::new();

        for arg in &self.string_variation_args {
            match &arg.candidate_values {
                CandidateValues::EnumKeys(candidate_values) => {
                    if let Some(enum_key) = used_enums.get(&arg.node) {
                        for combo in &mut result {
                            combo.push(Combo {
                                value: SVArgValue::EnumKey(enum_key.clone()),
                                is_collapsible: true,
                            });
                        }
                    } else {
                        let mut arg_combos = vec![];

                        for value in candidate_values {
                            for combo in &result {
                                used_enums.insert(arg.node, value.clone());

                                let mut new_combo = combo.clone();
                                new_combo.push(Combo {
                                    value: SVArgValue::EnumKey(value.clone()),
                                    is_collapsible: false,
                                });

                                arg_combos.push(new_combo);
                            }
                        }

                        result = arg_combos
                    }
                }
                _ => {}
            }
        }

        result
    }

    // recursive version
    pub fn get_string_variation_combinations(&mut self) -> Vec<Vec<Combo>> {
        let mut combos = vec![];
        self._get_string_variation_combinations(&mut combos, 0, vec![]);
        combos
    }

    fn _get_string_variation_combinations<'a>(
        &mut self,
        combos: &'a mut Vec<Vec<Combo>>,
        current_arg_index: usize,
        prev_args: Vec<Combo>,
    ) -> &'a mut Vec<Vec<Combo>> {
        if self.string_variation_args.is_empty() {
            return combos;
        }

        if current_arg_index >= self.string_variation_args.len() {
            combos.push(prev_args);
            return combos;
        }

        let current_arg = self.string_variation_args[current_arg_index].clone();

        match current_arg.candidate_values {
            CandidateValues::EnumKeys(ref candidate_values) => {
                if let Some(enum_key) = self.used_enums.get(&current_arg.node) {
                    self._get_string_variation_combinations(combos, current_arg_index + 1, {
                        let mut new_prev_args = prev_args.clone();
                        new_prev_args.push(Combo {
                            value: SVArgValue::EnumKey(enum_key.clone()),
                            is_collapsible: true,
                        });
                        new_prev_args
                    });
                    return combos;
                }

                for value in candidate_values {
                    self.used_enums.insert(current_arg.node, value.clone());

                    self._get_string_variation_combinations(combos, current_arg_index + 1, {
                        let mut new_prev_args = prev_args.clone();
                        new_prev_args.push(Combo {
                            value: SVArgValue::EnumKey(value.clone()),
                            is_collapsible: false,
                        });
                        new_prev_args
                    });
                }

                self.used_enums.remove(&current_arg.node);
                return combos;
            }

            _ => {}
        }

        combos
    }
}
